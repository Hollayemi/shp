import React from 'react';
import { Heart, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    isHost?: boolean;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Simulate checking for stored auth session
    useEffect(() => {
        const storedUser = localStorage.getItem('nomadnest_user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (error) {
                localStorage.removeItem('nomadnest_user');
            }
        }
        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string): Promise<void> => {
        setIsLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mock user data - in real app this would come from backend
            const mockUser: User = {
                id: '1',
                email,
                name: email.split('@')[0].replace(/[._-]/g, ' '),
                avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
                isHost: Math.random() > 0.5, // Randomly assign host status for demo
            };

            setUser(mockUser);
            localStorage.setItem('nomadnest_user', JSON.stringify(mockUser));
        } catch (error) {
            throw new Error('Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        setIsLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            const mockUser: User = {
                id: Date.now().toString(),
                email,
                name,
                avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
                isHost: false,
            };

            setUser(mockUser);
            localStorage.setItem('nomadnest_user', JSON.stringify(mockUser));
        } catch (error) {
            throw new Error('Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('nomadnest_user');
    };

    const value: AuthContextType = {
        user,
        login,
        register,
        logout,
        isLoading,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const featuredListings = [
    {
        id: 1,
        title: 'Modern Loft in Downtown',
        location: 'San Francisco, CA',
        price: 189,
        rating: 4.8,
        imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3',
    },
    {
        id: 2,
        title: 'Cozy Beach House',
        location: 'Malibu, CA',
        price: 299,
        rating: 4.9,
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 3,
        title: 'Mountain View Cabin',
        location: 'Denver, CO',
        price: 159,
        rating: 4.7,
        imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    }
];

const FeaturedListings: React.FC = () => {
    return (
        <section className="container mx-auto px-4 py-12">
            <h2 className="text-3xl font-bold mb-8 text-violet-900">Featured Stays</h2>
            <div className="grid grid-cols-1 @lg:grid-cols-3 gap-6">
                {featuredListings.map((listing) => (
                    <Card
                        key={listing.id}
                        className="overflow-hidden group transition-all duration-300 hover:shadow-lg rounded-xl pt-0"
                    >
                        <div className="relative">
                            <Image
                                src={listing.imageUrl}
                                alt={listing.title}
                                width={400}
                                height={300}
                                className="w-full h-48 object-cover"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-3 right-3 bg-white/80 rounded-full hover:bg-white w-8 h-8"
                            >
                                <Heart className="text-red-500 w-4 h-4" />
                            </Button>
                        </div>
                        <CardContent className="p-3">
                            <div className="flex flex-col justify-between items-start mb-2">
                                <h3 className="text-base font-semibold text-violet-900 leading-tight flex-1 pr-2">{listing.title}</h3>
                                <div className="flex items-center space-x-1 text-yellow-500 flex-shrink-0">
                                    <Star className="w-4 h-4 fill-current" />
                                    <span className="text-sm font-medium">{listing.rating}</span>
                                </div>
                            </div>
                            <p className="text-gray-600 text-sm mb-3">{listing.location}</p>
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-lg font-bold text-violet-800">${listing.price}</span>
                                    <span className="text-xs text-gray-500">per night</span>
                                </div>
                                {/* <Button className="bg-violet-600 hover:bg-violet-700 text-sm px-4 py-2 h-9">
                                    Book Now
                                </Button> */}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
};


import { MapPin, Twitter, Facebook, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-violet-900 text-white py-12">
            <div className="container mx-auto px-4 grid grid-cols-1 @md:grid-cols-4 gap-8">
                {/* Brand */}
                <div>
                    <div className="flex items-center space-x-2 mb-4">
                        <MapPin className="text-white w-8 h-8" />
                        <span className="text-2xl font-bold">NomadNest</span>
                    </div>
                    <p className="text-violet-200">Discover unique stays, connect with amazing hosts, and create unforgettable memories.</p>
                </div>

                {/* Company Links */}
                <div>
                    <h4 className="font-bold mb-4">Company</h4>
                    <ul className="space-y-2">
                        <li><a href="#" className="hover:text-violet-200 transition-colors">About Us</a></li>
                        <li><a href="#" className="hover:text-violet-200 transition-colors">Careers</a></li>
                        <li><a href="#" className="hover:text-violet-200 transition-colors">Press</a></li>
                        <li><a href="#" className="hover:text-violet-200 transition-colors">Investors</a></li>
                    </ul>
                </div>

                {/* Support Links */}
                <div>
                    <h4 className="font-bold mb-4">Support</h4>
                    <ul className="space-y-2">
                        <li><a href="#" className="hover:text-violet-200 transition-colors">Help Center</a></li>
                        <li><a href="#" className="hover:text-violet-200 transition-colors">Safety Information</a></li>
                        <li><a href="#" className="hover:text-violet-200 transition-colors">Cancellation Options</a></li>
                        <li><a href="#" className="hover:text-violet-200 transition-colors">Neighborhood Support</a></li>
                    </ul>
                </div>

                {/* Social Links */}
                <div>
                    <h4 className="font-bold mb-4">Connect With Us</h4>
                    <div className="flex space-x-4">
                        <a href="#" className="hover:text-violet-200 transition-colors"><Twitter /></a>
                        <a href="#" className="hover:text-violet-200 transition-colors"><Facebook /></a>
                        <a href="#" className="hover:text-violet-200 transition-colors"><Instagram /></a>
                    </div>
                </div>
            </div>

            {/* Copyright */}
            <div className="container mx-auto px-4 mt-8 pt-4 border-t border-violet-700 text-center">
                <p className="text-violet-300">© 2024 NomadNest. All rights reserved.</p>
            </div>
        </footer>
    );
};

import { Search, User, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Header: React.FC = () => {
    const { user, isAuthenticated } = useAuth();

    return (
        <header className="sticky top-0 z-50 bg-white shadow-sm">
            <div className="container mx-auto flex items-center justify-between px-4 py-4">
                {/* Logo */}
                <div className="flex items-center space-x-2">
                    <MapPin className="text-violet-600 w-8 h-8" />
                    <span className="text-2xl font-bold text-violet-800">NomadNest</span>
                </div>

                {/* Search Bar */}
                <div className="flex items-center space-x-2 bg-gray-100 rounded-full px-4 py-2 w-1/2">
                    <Search className="text-gray-500" />
                    <Input
                        placeholder="Where are you going?"
                        className="border-none bg-transparent focus:outline-none"
                    />
                </div>

                {/* Navigation & Auth */}
                <div className="flex items-center space-x-4">
                    <nav className="hidden @md:flex space-x-4">
                    </nav>

                    <div className="flex items-center space-x-2">
                        {/* <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-violet-50">
                            <Menu />
                        </Button> */}
                        {isAuthenticated ? (
                            <UserMenu />
                        ) : (
                            <LoginModal>
                                <Button variant="outline" className="rounded-full" >
                                    <User className="mr-2" /> Login
                                </Button>
                            </LoginModal>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

import { Settings, Home, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface LoginModalProps {
    children: React.ReactNode;
}

const LoginModal: React.FC<LoginModalProps> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
            toast.success('Welcome back!');
            setIsOpen(false);
            setEmail('');
            setPassword('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Log in to NomadNest</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Logging in...
                                </>
                            ) : (
                                'Log in'
                            )}
                        </Button>
                        <div className="text-center text-sm text-gray-600">
                            <span>Don&apos;t have an account? </span>
                            <SignupModal>
                                <button
                                    type="button"
                                    className="text-violet-600 hover:text-violet-800 font-medium"
                                >
                                    Sign up
                                </button>
                            </SignupModal>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

interface SignupModalProps {
    children: React.ReactNode;
}

const SignupModal: React.FC<SignupModalProps> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { register } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !email || !password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        setIsLoading(true);
        try {
            await register(name, email, password);
            toast.success('Account created successfully! Welcome to NomadNest!');
            setIsOpen(false);
            setName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create your account</DialogTitle>
                    <p className="text-sm text-gray-600">Join thousands of travelers worldwide.</p>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                            id="signup-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                            <Input
                                id="signup-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Create a password (min. 6 characters)"
                                required
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </Button>
                        <div className="text-center text-sm text-gray-600">
                            <span>Already have an account? </span>
                            <LoginModal>
                                <button
                                    type="button"
                                    className="text-violet-600 hover:text-violet-800 font-medium"
                                >
                                    Log in
                                </button>
                            </LoginModal>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const UserMenu: React.FC = () => {
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="flex items-center space-x-2 px-3 py-2 rounded-full border border-gray-300 hover:bg-gray-50"
                >
                    <Menu className="h-4 w-4" />
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback>
                            {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
                <div className="px-4 py-3 border-b">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                </div>

                {user?.isHost && (
                    <DropdownMenuItem className="cursor-pointer">
                        <Home className="mr-2 h-4 w-4" />
                        <span>My Listings</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


// Simple Booking Modal Component
interface BookingModalProps {
    children: React.ReactNode;
    listing: {
        title: string;
        price: number;
        location: string;
    };
}

const BookingModal: React.FC<BookingModalProps> = ({ children, listing }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [guests, setGuests] = useState('2');

    const handleBooking = () => {
        if (!checkIn || !checkOut) {
            toast.error('Please select check-in and check-out dates');
            return;
        }
        toast.success(`Booking confirmed for ${listing.title}!`);
        setIsOpen(false);
        setCheckIn('');
        setCheckOut('');
        setGuests('2');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Book {listing.title}</DialogTitle>
                    <p className="text-sm text-gray-600">{listing.location}</p>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="checkin">Check-in</Label>
                            <Input
                                id="checkin"
                                type="date"
                                value={checkIn}
                                onChange={(e) => setCheckIn(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="checkout">Check-out</Label>
                            <Input
                                id="checkout"
                                type="date"
                                value={checkOut}
                                onChange={(e) => setCheckOut(e.target.value)}
                                min={checkIn || new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="guests">Guests</Label>
                        <select
                            id="guests"
                            value={guests}
                            onChange={(e) => setGuests(e.target.value)}
                            className="w-full p-2 border rounded-md"
                        >
                            <option value="1">1 guest</option>
                            <option value="2">2 guests</option>
                            <option value="3">3 guests</option>
                            <option value="4">4 guests</option>
                        </select>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">Total</span>
                            <span className="text-lg font-bold text-violet-800">${listing.price}/night</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button onClick={handleBooking} className="flex-1 bg-violet-600 hover:bg-violet-700">
                            Book Now
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <div className="min-h-screen bg-white flex flex-col">
                <Header />

                <main className="flex-grow">
                    <FeaturedListings />
                    {/* Placeholder sections for other features */}
                    <section className="container mx-auto px-4 py-12 text-center bg-violet-50">
                        <h2 className="text-3xl font-bold text-violet-900 mb-4">Discover Your Next Adventure</h2>
                        <p className="text-gray-700 max-w-2xl mx-auto">
                            From city apartments to countryside retreats, find unique spaces that feel like home.
                        </p>
                    </section>
                </main>
                <Footer />
            </div>
        </AuthProvider>
    );
};

export default App;

