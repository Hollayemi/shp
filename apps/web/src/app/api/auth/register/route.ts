import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateSlug } from 'random-word-slugs';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db';
import { encharge } from '@/lib/encharge';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Helper function to generate unique personal team slug
async function generatePersonalTeamSlug(): Promise<string> {
  let slug: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    // Generate a slug like "personal-happy-cat" or "personal-bright-moon"
    const randomSlug = generateSlug(2, { format: "kebab" });
    slug = `personal-${randomSlug}`;
    
    // Check if slug already exists
    const existingTeam = await prisma.team.findUnique({
      where: { slug }
    });
    
    if (!existingTeam) {
      return slug;
    }
    
    attempts++;
  } while (attempts < maxAttempts);

  // Fallback: use nanoid if all attempts failed
  return `personal-${nanoid(10)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Registration request body:', body);
    const validatedFields = registerSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid fields', details: validatedFields.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password } = validatedFields.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with personal team
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    console.log(user);

    // Create personal team for the new user
    const slug = await generatePersonalTeamSlug();
    await prisma.team.create({
      data: {
        name: `${user.name}'s Team`,
        description: `Personal workspace for ${user.name}`,
        slug,
        isPersonal: true,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER'
          }
        }
      }
    });

    // Track user registration in Encharge (async, don't wait for completion)
    encharge.trackUserRegistration({
      id: user.id,
      name: user.name || 'Unknown User',
      email: user.email,
    }).catch(error => {
      console.error('Failed to track user registration in Encharge:', error);
      // Don't fail the registration if Encharge tracking fails
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: userWithoutPassword 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error >>' + error },
      { status: 500 }
    );
  }
} 