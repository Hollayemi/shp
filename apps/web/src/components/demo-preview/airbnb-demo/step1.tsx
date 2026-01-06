import { Search, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

const Header: React.FC = () => {
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
                    <nav className="hidden @lg:flex space-x-4">
                    </nav>

                    <div className="flex items-center space-x-2">
                        {/* <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-violet-50">
                            <Menu />
                        </Button> */}
                    </div>
                </div>
            </div>
        </header>
    );
};

import React from 'react';
import { MapPin, Twitter, Facebook, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-violet-900 text-white py-12">
            <div className="container mx-auto px-4 grid grid-cols-1 @lg:grid-cols-4 gap-8">
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

import { Heart, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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



import { Toaster } from 'sonner';

const App: React.FC = () => {
    return (
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
            <Toaster richColors position="top-right" />
        </div>
    );
};

export default App;