import React, { useState } from 'react';
import Image from 'next/image';
import { CalendarDays, Users, DollarSign, Loader2, X, Twitter, Facebook, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createContext, useContext, useEffect, ReactNode } from 'react';

export interface Listing {
  id: any;
  title: string;
  location: string;
  price: number;
  rating: number;
  imageUrl: string;
  description?: string;
  amenities?: string[];
  host?: {
    name: string;
    avatar: string;
    rating: number;
  };
  reviews?: number;
  maxGuests?: number;
  bedrooms?: number;
  bathrooms?: number;
}

export interface Booking {
  id: string;
  listing: Listing;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
  userId: string;
}

interface BookingContextType {
  bookings: Booking[];
  createBooking: (listing: Listing, checkIn: Date, checkOut: Date, guests: number) => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  isLoading: boolean;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

interface BookingProviderProps {
  children: ReactNode;
}

export const BookingProvider: React.FC<BookingProviderProps> = ({ children }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Mock data for featured listings that can be booked
  const mockListings: Listing[] = [
    {
      id: '1',
      title: 'Modern Loft in Downtown',
      location: 'San Francisco, CA',
      price: 189,
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1513584684374-8133440eedc1',
      description: 'Stunning modern loft with panoramic city views, perfect for a city break. Features open floor plan with floor-to-ceiling windows and designer furnishings.',
      amenities: ['WiFi', 'Kitchen', 'Washer', 'Air conditioning', 'Workspace'],
      host: { name: 'Sarah Johnson', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Sarah', rating: 4.9 },
      reviews: 127,
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 1,
    },
    {
      id: '2',
      title: 'Cozy Beach House',
      location: 'Malibu, CA',
      price: 299,
      rating: 4.9,
      imageUrl: 'https://images.unsplash.com/photo-1565475707704-bdcad4c9cc5a',
      description: 'Charming beachfront house with private access to the ocean. Wake up to the sound of waves and enjoy sunsets from your private deck.',
      amenities: ['Beach access', 'Pool', 'Kitchen', 'BBQ', 'Parking', 'WiFi'],
      host: { name: 'Mike Chen', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Mike', rating: 4.8 },
      reviews: 89,
      maxGuests: 6,
      bedrooms: 3,
      bathrooms: 2,
    },
    {
      id: '3',
      title: 'Mountain View Cabin',
      location: 'Denver, CO',
      price: 159,
      rating: 4.7,
      imageUrl: 'https://images.unsplash.com/photo-1559310589-2673bfe16032',
      description: 'Rustic mountain cabin surrounded by pine forests. Perfect for hikes, skiing, or simply disconnecting from the world.',
      amenities: ['Fireplace', 'Mountain views', 'Hiking trails', 'Kitchen', 'Washer', 'WiFi'],
      host: { name: 'Emma Davis', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Emma', rating: 4.7 },
      reviews: 56,
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 1,
    }
  ];

  // Load user's bookings from localStorage
  useEffect(() => {
    if (user) {
      const storedBookings = localStorage.getItem(`nomadnest_bookings_${user.id}`);
      if (storedBookings) {
        try {
          const parsedBookings = JSON.parse(storedBookings).map((booking: any) => ({
            ...booking,
            checkIn: new Date(booking.checkIn),
            checkOut: new Date(booking.checkOut),
            createdAt: new Date(booking.createdAt),
          }));
          setBookings(parsedBookings);
        } catch (error) {
          console.error('Error parsing stored bookings:', error);
        }
      }
    } else {
      setBookings([]);
    }
  }, [user]);

  const createBooking = async (listing: Listing, checkIn: Date, checkOut: Date, guests: number): Promise<void> => {
    if (!isAuthenticated || !user) {
      throw new Error('Please log in to make a booking');
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Calculate total price
      const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalPrice = listing.price * days;

      const newBooking: Booking = {
        id: Date.now().toString(),
        listing,
        checkIn,
        checkOut,
        guests,
        totalPrice,
        status: 'confirmed', // In real app, this would be 'pending' until host approves
        createdAt: new Date(),
        userId: user.id,
      };

      const updatedBookings = [...bookings, newBooking];
      setBookings(updatedBookings);

      // Store in localStorage
      localStorage.setItem(`nomadnest_bookings_${user.id}`, JSON.stringify(updatedBookings));

      toast.success(`Booking confirmed! Total: $${totalPrice}`);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBooking = async (bookingId: string): Promise<void> => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedBookings = bookings.map(booking =>
        booking.id === bookingId ? { ...booking, status: 'cancelled' as const } : booking
      );

      setBookings(updatedBookings);
      localStorage.setItem(`nomadnest_bookings_${user.id}`, JSON.stringify(updatedBookings));

      toast.success('Booking cancelled successfully');
    } catch (error) {
      toast.error('Failed to cancel booking');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: BookingContextType = {
    bookings,
    createBooking,
    cancelBooking,
    isLoading,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

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

interface BookingModalProps {
  listing: Listing;
  isOpen: boolean;
  onClose: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ listing, isOpen, onClose }) => {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createBooking } = useBooking();
  const { isAuthenticated } = useAuth();

  const handleBooking = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to make a booking');
      return;
    }

    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates');
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const guestsNum = parseInt(guests);

    if (checkInDate >= checkOutDate) {
      toast.error('Check-out date must be after check-in date');
      return;
    }

    if (checkOutDate < new Date()) {
      toast.error('Check-out date cannot be in the past');
      return;
    }

    if (guestsNum < 1 || guestsNum > (listing.maxGuests || 4)) {
      toast.error(`Please select 1-${listing.maxGuests || 4} guests`);
      return;
    }

    setIsSubmitting(true);
    try {
      await createBooking(listing, checkInDate, checkOutDate, guestsNum);
      onClose();
      setCheckIn('');
      setCheckOut('');
      setGuests('1');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Booking failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    if (!checkIn || !checkOut) return 0;
    const days = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? listing.price * days : 0;
  };

  const totalPrice = calculateTotal();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Book {listing.title}
            {/* <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button> */}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkin" className="flex items-center">
                <CalendarDays className="mr-2 h-4 w-4" />
                Check-in
              </Label>
              <Input
                id="checkin"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout" className="flex items-center">
                <CalendarDays className="mr-2 h-4 w-4" />
                Check-out
              </Label>
              <Input
                id="checkout"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <Label htmlFor="guests" className="flex items-center">
              <Users className="mr-2 h-4 w-4" />
              Guests
            </Label>
            <Select value={guests} onValueChange={setGuests}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: listing.maxGuests || 4 }, (_, i) => i + 1).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} guest{num > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>${listing.price} × {Math.ceil((new Date(checkOut || checkIn).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)) || 1} nights</span>
              <span>${totalPrice}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span className="flex items-center">
                <DollarSign className="mr-1 h-4 w-4" />
                Total
              </span>
              <span>${totalPrice}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleBooking}
              disabled={isSubmitting || totalPrice === 0}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Booking...
                </>
              ) : (
                `Book Now - $${totalPrice}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { Heart, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const featuredListings: Listing[] = [
  {
    id: '1',
    title: 'Modern Loft in Downtown',
    location: 'San Francisco, CA',
    price: 189,
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3',
    description: 'Stunning modern loft with panoramic city views, perfect for a city break.',
    amenities: ['WiFi', 'Kitchen', 'Washer', 'Air conditioning', 'Workspace'],
    host: { name: 'Sarah Johnson', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Sarah', rating: 4.9 },
    reviews: 127,
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
  },
  {
    id: '2',
    title: 'Cozy Beach House',
    location: 'Malibu, CA',
    price: 299,
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    description: 'Charming beachfront house with private access to the ocean.',
    amenities: ['Beach access', 'Pool', 'Kitchen', 'BBQ', 'Parking', 'WiFi'],
    host: { name: 'Mike Chen', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Mike', rating: 4.8 },
    reviews: 89,
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 2,
  },
  {
    id: '3',
    title: 'Mountain View Cabin',
    location: 'Denver, CO',
    price: 159,
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    description: 'Rustic mountain cabin surrounded by pine forests.',
    amenities: ['Fireplace', 'Mountain views', 'Hiking trails', 'Kitchen', 'Washer', 'WiFi'],
    host: { name: 'Emma Davis', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Emma', rating: 4.7 },
    reviews: 56,
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
  }
];



const FeaturedListings: React.FC = () => {
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const handleBookNow = (listing: Listing) => {
    setSelectedListing(listing);
    setIsBookingModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsBookingModalOpen(false);
    setSelectedListing(null);
  };

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
                className="absolute top-3 right-3 bg-background/80 rounded-full hover:bg-background w-8 h-8"
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
              <p className="text-muted-foreground text-sm mb-3">{listing.location}</p>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-violet-800">${listing.price}</span>
                  <span className="text-xs text-muted-foreground">per night</span>
                </div>
                <Button
                  className="bg-violet-600 hover:bg-violet-700 text-sm px-4 py-2 h-9"
                  onClick={() => handleBookNow(listing)}
                >
                  Book Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedListing && (
        <BookingModal
          listing={selectedListing}
          isOpen={isBookingModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </section>
  );
};

import { MapPin } from 'lucide-react';

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

interface HeaderProps {
  onNavigate: (view: 'home' | 'bookings') => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-background shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        {/* Logo */}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('home')}>
          <MapPin className="text-violet-600 w-8 h-8" />
          <span className="text-2xl font-bold text-violet-800">NomadNest</span>
        </div>

        {/* Search Bar */}
        <div className="flex items-center space-x-2 bg-muted rounded-full px-4 py-2 w-1/2">
          <Search className="text-muted-foreground" />
          <Input
            placeholder="Where are you going?"
            className="border-none bg-transparent focus:outline-none text-foreground"
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
              <UserMenu onNavigate={onNavigate} />
            ) : (
              <LoginModal>
                <Button variant="outline" className="rounded-full">
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

import { Eye, EyeOff, } from 'lucide-react';
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
              <button
                type="button"
                className="text-violet-600 hover:text-violet-800 font-medium"
                onClick={() => toast.info('Sign up modal would open here')}
              >
                Sign up
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { Calendar, } from 'lucide-react';

interface MyBookingsProps {
  onNavigate?: (view: 'home' | 'bookings') => void;
}

const MyBookings: React.FC<MyBookingsProps> = ({ onNavigate }) => {
  const { bookings, cancelBooking } = useBooking();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  const handleCancel = (bookingId: string) => {
    setCancelBookingId(bookingId);
  };

  const confirmCancel = async () => {
    if (cancelBookingId) {
      await cancelBooking(cancelBookingId);
      setCancelBookingId(null);
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <Calendar className="mx-auto h-16 w-16 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900">No bookings yet</h2>
          <p className="text-gray-600">
            You haven&apos;t made any bookings. Start exploring amazing places to stay!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-violet-900 mb-2">My Bookings</h1>
            <p className="text-muted-foreground">Manage your upcoming and past stays</p>
          </div>
          {onNavigate && (
            <Button
              variant="outline"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Browse Listings
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 @md:grid-cols-2 @lg:grid-cols-3">
        {[...bookings].reverse().map((booking) => (
          <Card key={booking.id} className="overflow-hidden">
            <div className="aspect-video relative overflow-hidden">
              <Image
                src={booking.listing.imageUrl}
                alt={booking.listing.title}
                width={400}
                height={225}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 right-4">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(booking.status)}`}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </span>
              </div>
            </div>

            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2">{booking.listing.title}</h3>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="mr-1 h-4 w-4" />
                  {booking.listing.location}
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="mr-1 h-4 w-4" />
                  {booking.checkIn.toLocaleDateString()} - {booking.checkOut.toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-violet-800">
                  <DollarSign className="inline h-4 w-4" />
                  {booking.totalPrice}
                </div>

                {booking.status === 'confirmed' && new Date(booking.checkIn) > new Date() && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(booking.id)}
                    className="text-xs"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!cancelBookingId} onOpenChange={() => setCancelBookingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setCancelBookingId(null)}
                className="text-foreground border-border hover:bg-muted"
              >
                Keep Booking
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancel}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Cancel Booking
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
              <button
                type="button"
                className="text-violet-600 hover:text-violet-800 font-medium"
                onClick={() => toast.info('Login modal would open here')}
              >
                Log in
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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

interface UserMenuProps {
  onNavigate: (view: 'home' | 'bookings') => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onNavigate }) => {
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
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <DropdownMenuItem className="cursor-pointer" onClick={() => onNavigate('home')}>
          <Home className="mr-2 h-4 w-4" />
          <span>Browse Listings</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer" onClick={() => onNavigate('bookings')}>
          <Calendar className="mr-2 h-4 w-4" />
          <span>My Bookings</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer" onClick={() => toast.info('Profile page coming soon!')}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>

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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'bookings'>('home');

  return (
    <AuthProvider>
      <BookingProvider>
        <div className="min-h-screen bg-background flex flex-col">
          <Header onNavigate={setCurrentView} />

          <main className="flex-grow">
            {currentView === 'home' ? (
              <>
                <FeaturedListings />
                {/* Placeholder sections for other features */}
                <section className="container mx-auto px-4 py-12 text-center bg-violet-50">
                  <h2 className="text-3xl font-bold text-violet-900 mb-4">Discover Your Next Adventure</h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    From city apartments to countryside retreats, find unique spaces that feel like home.
                  </p>
                </section>
              </>
            ) : (
              <MyBookings onNavigate={setCurrentView} />
            )}
          </main>

          <Footer />
        </div>
      </BookingProvider>
    </AuthProvider>
  );
};

export default App;