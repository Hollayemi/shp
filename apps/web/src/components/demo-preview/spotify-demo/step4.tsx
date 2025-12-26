import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { Play, Share2, MessageCircle } from 'lucide-react'
import { TrendingUp, Sparkles, Globe, Mic, RadioIcon, Star } from 'lucide-react'
import { Users, MoreVertical, Send } from 'lucide-react'
import { Search, Bell, User } from 'lucide-react'
import { Heart, Clock } from 'lucide-react'
import {
    Pause,
    SkipForward,
    SkipBack,
    Repeat,
    Shuffle,
    Volume2
} from 'lucide-react'
import { Home, ListMusic, Podcast, Compass } from 'lucide-react'
import { Music, Share } from 'lucide-react'
import { toast } from 'sonner'

interface Track {
    id: string
    title: string
    artist: string
    album: string
    coverUrl: string
}

interface AlbumGridProps {
    onTrackSelect: (track: Track) => void
}

const sampleTracks: Track[] = [
    {
        id: '1',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop'
    },
    {
        id: '2',
        title: 'Dance Monkey',
        artist: 'Tones and I',
        album: 'The Kids Are Coming',
        coverUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop'
    },
    {
        id: '3',
        title: 'Bad Guy',
        artist: 'Billie Eilish',
        album: 'When We All Fall Asleep, Where Do We Go?',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop'
    },
    {
        id: '4',
        title: 'Everything You Want',
        artist: 'Vertical Horizon',
        album: 'Everything You Want',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop'
    },
    {
        id: '5',
        title: 'Stay with Me',
        artist: 'Sam Smith',
        album: 'In the Lonely Hour',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop'
    }
]

const handleShare = (track: Track) => {
    const shareData = {
        title: `Listen to "${track.title}" by ${track.artist}`,
        text: `Check out this amazing track: ${track.title} by ${track.artist}`,
        url: `${window.location.href}#track/${track.id}`
    }

    if (navigator.share) {
        navigator.share(shareData)
        toast.success('Shared with friends!')
    } else {
        navigator.clipboard.writeText(shareData.url)
        toast.success('Link copied to clipboard!')
    }
}

const handleLike = (track: Track) => {
    toast.success(`Added "${track.title}" to your favorites!`)
}

const handleComment = (track: Track) => {
    toast.info('Comments feature coming soon!')
}

export const AlbumGrid: React.FC<AlbumGridProps> = ({ onTrackSelect }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">Popular Tracks</h2>
            <div className="grid grid-cols-2 @md:grid-cols-3 gap-6">
                {sampleTracks.map((track) => (
                    <div
                        key={track.id}
                        className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-all group relative"
                    >
                        <Image
                            src={track.coverUrl}
                            alt={track.title}
                            width={150}
                            height={150}
                            className="w-full rounded-md mb-4 shadow-lg"
                        />
                        <div className="text-sm mb-3">
                            <h3 className="font-semibold">{track.title}</h3>
                            <p className="text-gray-400">{track.artist}</p>
                        </div>

                        {/* Social action buttons */}
                        <div className="flex justify-between items-center">
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleLike(track)}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Heart size={16} />
                                </button>
                                <button
                                    onClick={() => handleShare(track)}
                                    className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                    <Share2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleComment(track)}
                                    className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                                >
                                    <MessageCircle size={16} />
                                </button>
                            </div>

                            <button
                                onClick={() => onTrackSelect(track)}
                                className="bg-green-500 text-black rounded-full p-2 hover:bg-green-400 transform hover:scale-110 transition-all"
                            >
                                <Play size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

interface TrendingTrack {
    id: string
    title: string
    artist: string
    coverUrl: string
    position: number
    change: 'up' | 'down' | 'same'
}

interface DiscoverProps {
    onTrackSelect: (track: any) => void
}

const trendingTracks: TrendingTrack[] = [
    {
        id: 't1',
        title: 'Dreams',
        artist: 'Fleetwood Mac',
        coverUrl: 'https://i.scdn.co/image/ab67616d0000b273e319baafd16e84f0408af2a0',
        position: 1,
        change: 'up'
    },
    {
        id: 't3',
        title: 'Anti-Hero',
        artist: 'Taylor Swift',
        coverUrl: 'https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5',
        position: 3,
        change: 'same'
    },
    {
        id: 't4',
        title: 'As It Was',
        artist: 'Harry Styles',
        coverUrl: 'https://i.scdn.co/image/ab67616d0000b273be841ba4bc24340152e3a79a',
        position: 4,
        change: 'down'
    },
]

const genres = [
    { name: 'Pop', color: 'from-pink-500 to-purple-500', icon: '🎵' },
    { name: 'Rock', color: 'from-red-500 to-pink-500', icon: '🥁' },
    { name: 'Hip Hop', color: 'from-yellow-500 to-orange-500', icon: '🎤' },
    { name: 'Jazz', color: 'from-blue-500 to-indigo-500', icon: '🎷' },
    { name: 'Electronic', color: 'from-cyan-500 to-blue-500', icon: '🔊' },
    { name: 'Country', color: 'from-green-500 to-teal-500', icon: '🐎' }
]

const handleGenreClick = (genreName: string) => {
    toast.info(`Discovering ${genreName} music!`)
}

const getChangeIndicator = (change: string) => {
    switch (change) {
        case 'up': return <TrendingUp className="text-green-500" size={14} />
        case 'down': return <TrendingUp className="text-red-500 rotate-180" size={14} />
        default: return <div className="w-3.5 h-3.5 rounded-full bg-gray-500"></div>
    }
}

export const Discover: React.FC<DiscoverProps> = ({ onTrackSelect }) => {
    return (
        <div className="p-6">
            {/* Genres Section */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-4">
                    <Sparkles className="text-purple-500" size={24} />
                    <h2 className="text-2xl font-bold">Genres & Moods</h2>
                </div>
                <div className="grid grid-cols-2 @md:grid-cols-3 gap-4">
                    {genres.map((genre) => (
                        <button
                            key={genre.name}
                            onClick={() => handleGenreClick(genre.name)}
                            className={`bg-gradient-to-br ${genre.color} rounded-lg p-6 hover:scale-105 transition-transform duration-200 text-center group`}
                        >
                            <div className="text-4xl mb-2">{genre.icon}</div>
                            <h3 className="font-bold text-white">{genre.name}</h3>
                        </button>
                    ))}
                </div>
            </div>

            {/* Trending Section */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-6">
                    <TrendingUp className="text-red-500" size={24} />
                    <h2 className="text-2xl font-bold">Trending Now</h2>
                </div>

                <div className="bg-gray-800 rounded-lg p-0">
                    {trendingTracks.map((track, index) => (
                        <div
                            key={track.id}
                            className={`flex items-center space-x-4 p-4 ${index < trendingTracks.length - 1 ? 'border-b border-gray-700' : ''} hover:bg-gray-700 transition-colors cursor-pointer group`}
                            onClick={() => onTrackSelect(track)}
                        >
                            <div className="flex items-center space-x-3 w-16">
                                <span className={`text-lg font-bold ${track.position <= 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                    {track.position}
                                </span>
                                <div className="flex items-center">
                                    {getChangeIndicator(track.change)}
                                </div>
                            </div>

                            <Image
                                src={track.coverUrl}
                                alt={track.title}
                                width={64}
                                height={64}
                                className="w-16 h-16 rounded group-hover:shadow-lg"
                            />

                            <div className="flex-1">
                                <h3 className="font-semibold group-hover:text-green-400 transition-colors">{track.title}</h3>
                                <p className="text-gray-400">{track.artist}</p>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onTrackSelect(track)
                                }}
                                className="bg-green-500 text-black rounded-full p-2 hover:bg-green-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Play size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* New Releases Section */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-6">
                    <Globe className="text-blue-500" size={24} />
                    <h2 className="text-2xl font-bold">New Releases</h2>
                </div>

                <div className="grid grid-cols-2 @md:grid-cols-3 gap-6">
                    {[
                        { title: 'Midnights', artist: 'Taylor Swift', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5' },
                        { title: 'Harry\'s House', artist: 'Harry Styles', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273be841ba4bc24340152e3a79a' },
                        { title: 'Sour', artist: 'Olivia Rodrigo (Exclusive)', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a' },
                        { title: 'Planet Her', artist: 'Doja Cat', coverUrl: 'https://i.scdn.co/image/ab67616d0000b273be841ba4bc24340152e3a79a' },
                    ].map((album, index) => (
                        <div key={index} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group cursor-pointer">
                            <Image
                                src={album.coverUrl}
                                alt={album.title}
                                width={150}
                                height={150}
                                className="w-full rounded-md mb-4 object-cover aspect-square"
                            />
                            <h3 className="font-semibold text-sm mb-1">{album.title}</h3>
                            <p className="text-gray-400 text-xs">{album.artist}</p>
                            <button className="w-full mt-3 bg-green-500 text-black rounded-full py-2 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                Play
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Radio Stations */}
            <div>
                <div className="flex items-center space-x-3 mb-6">
                    <h2 className="text-2xl font-bold">Popular Radio</h2>
                </div>

                <div className="grid grid-cols-2 @md:grid-cols-3 gap-4">
                    {[
                        { name: 'Today\'s Top Hits', description: 'The most played songs right now', coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop' },
                        { name: 'Pop Radio', description: 'All the pop hits', coverUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop' },
                        { name: 'Indie Station', description: 'Curated indie tunes', coverUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop' },
                        { name: 'Hip Hop Central', description: 'Best hip hop tracks', coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop' },
                        { name: 'Rock Legends', description: 'Classic rock anthems', coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=150&h=150&fit=crop' },
                        { name: 'Jazz Cafe', description: 'Smooth jazz vibes', coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop' }
                    ].map((station, index) => (
                        <div key={index} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group cursor-pointer">
                            <Image
                                src={station.coverUrl}
                                alt={station.name}
                                width={150}
                                height={150}
                                className="w-full rounded-md mb-3 object-cover aspect-square"
                            />
                            <h3 className="font-semibold text-sm mb-1">{station.name}</h3>
                            <p className="text-gray-400 text-xs mb-3 line-clamp-2">{station.description}</p>
                            <button className="w-full bg-green-500 text-black rounded-full py-2 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                Tune In
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

interface Friend {
    id: string
    name: string
    avatar: string
    status: 'online' | 'listening' | 'offline'
    currentTrack?: string
    isOnline: boolean
}

const sampleFriends: Friend[] = [
    {
        id: '1',
        name: 'Alex Johnson',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
        status: 'listening',
        currentTrack: 'Blinding Lights',
        isOnline: true
    },
    {
        id: '2',
        name: 'Sarah Chen',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5e5?w=40&h=40&fit=crop&crop=face',
        status: 'online',
        isOnline: true
    },
    {
        id: '3',
        name: 'Mike Rodriguez',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
        status: 'listening',
        currentTrack: 'Dance Monkey',
        isOnline: true
    },
    {
        id: '4',
        name: 'Emma Wilson',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
        status: 'offline',
        isOnline: false
    },
    {
        id: '5',
        name: 'David Lee',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
        status: 'online',
        isOnline: true
    }
]

const getStatusColor = (status: string, isOnline: boolean) => {
    if (!isOnline) return 'bg-gray-500'
    switch (status) {
        case 'online': return 'bg-green-500'
        case 'listening': return 'bg-purple-500'
        default: return 'bg-gray-500'
    }
}

const getStatusText = (friend: Friend) => {
    if (!friend.isOnline) return 'Offline'
    switch (friend.status) {
        case 'listening': return `Listening to ${friend.currentTrack}`
        case 'online': return 'Online'
        default: return 'Online'
    }
}

const handleShareMusic = (friend: Friend, currentTrack: any) => {
    toast.success(`Shared music with ${friend.name}!`)
}

export const FriendsList: React.FC<{ currentTrack?: any }> = ({ currentTrack }) => {
    const onlineFriends = sampleFriends.filter(friend => friend.isOnline)

    return (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Users className="text-blue-500" size={20} />
                    <h3 className="font-semibold">Friends ({onlineFriends.length})</h3>
                </div>
                <MoreVertical className="text-gray-400 cursor-pointer hover:text-white" size={16} />
            </div>

            <div className="space-y-3">
                {sampleFriends.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded-lg transition-colors">
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <Image
                                    src={friend.avatar}
                                    alt={friend.name}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-full"
                                />
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(friend.status, friend.isOnline)} border-2 border-gray-800 rounded-full`}></div>
                            </div>

                            <div className="flex-1">
                                <p className="font-medium text-sm">{friend.name}</p>
                                <p className="text-xs text-gray-400">{getStatusText(friend)}</p>
                            </div>
                        </div>

                        <div className="flex space-x-2">
                            {friend.isOnline && currentTrack && (
                                <button
                                    onClick={() => handleShareMusic(friend, currentTrack)}
                                    className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                    title={`Share music with ${friend.name}`}
                                >
                                    <Send size={14} />
                                </button>
                            )}
                            <button className="p-2 text-gray-400 hover:text-gray-300 transition-colors">
                                <MessageCircle size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                <button className="text-blue-500 hover:text-blue-400 text-sm font-medium transition-colors">
                    + Add Friend
                </button>
            </div>
        </div>
    )
}

export const Header: React.FC = () => {
    return (
        <header className="flex justify-between items-center p-4 bg-transparent">
            <div className="flex items-center space-x-4">
                <Search className="text-gray-300 hover:text-white transition-colors" size={24} />
                <input
                    type="text"
                    placeholder="Search music"
                    className="bg-gray-700 text-white px-4 py-2 rounded-full w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div className="flex items-center space-x-4">
                <Bell className="text-gray-300 hover:text-white transition-colors" size={24} />
                <div className="bg-gray-700 rounded-full p-2 hover:bg-gray-600 transition-colors">
                    <User className="text-white" size={24} />
                </div>
            </div>
        </header>
    )
}

interface MusicPlayerProps {
    currentTrack: any
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ currentTrack }) => {
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        if (currentTrack) {
            setIsPlaying(true)
        }
    }, [currentTrack])

    const togglePlay = () => setIsPlaying(!isPlaying)

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-800 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4 w-1/3">
                {currentTrack ? (
                    <>
                        <Image
                            src={currentTrack.coverUrl}
                            alt={currentTrack.title}
                            width={64}
                            height={64}
                            className="w-16 h-16 rounded-md"
                        />
                        <div>
                            <h3 className="font-semibold">{currentTrack.title}</h3>
                            <p className="text-gray-400 text-sm">{currentTrack.artist}</p>
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500">No track selected</p>
                )}
            </div>

            <div className="flex flex-col items-center w-1/3">
                <div className="flex items-center space-x-6 mb-2">
                    <Shuffle className="text-gray-400 hover:text-white cursor-pointer" size={20} />
                    <SkipBack className="text-gray-400 hover:text-white cursor-pointer" size={24} />
                    <button
                        onClick={togglePlay}
                        className="bg-white text-black rounded-full p-2 hover:bg-gray-200"
                    >
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                    <SkipForward className="text-gray-400 hover:text-white cursor-pointer" size={24} />
                    <Repeat className="text-gray-400 hover:text-white cursor-pointer" size={20} />
                </div>
                <div className="w-full flex items-center space-x-2">
                    <span className="text-xs text-gray-500">0:00</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-1">
                        <div
                            className="bg-green-500 rounded-full h-1"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <span className="text-xs text-gray-500">3:45</span>
                </div>
            </div>

            <div className="flex items-center space-x-4 w-1/3 justify-end">
                <Volume2 className="text-gray-400 hover:text-white cursor-pointer" size={20} />
                <input
                    type="range"
                    min="0"
                    max="100"
                    className="w-24 h-1 bg-gray-700 appearance-none"
                />
            </div>
        </div>
    )
}

interface Podcast {
    id: string
    title: string
    host: string
    description: string
    coverUrl: string
    category: string
    totalEpisodes: number
    followers: number
    rating: number
    isSubscribed: boolean
}

interface Episode {
    id: string
    podcastId: string
    title: string
    description: string
    duration: string
    publishDate: string
    coverUrl: string
    playCount: number
}

interface PodcastsProps {
    onEpisodeSelect?: (episode: Episode, podcast: Podcast) => void
}

const podcasts: Podcast[] = [
    {
        id: '1',
        title: 'The Game Changers',
        host: 'Alex Rodriguez',
        description: 'Deep dives into gaming culture, esports, and indie development',
        coverUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300&h=300&fit=crop',
        category: 'Gaming',
        totalEpisodes: 142,
        followers: 45600,
        rating: 4.9,
        isSubscribed: true
    },
    {
        id: '2',
        title: 'Tech Unfiltered',
        host: 'Sarah Chen & Mike Johnson',
        description: 'Cutting-edge tech news, product reviews, and industry insights',
        coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=300&fit=crop',
        category: 'Technology',
        totalEpisodes: 89,
        followers: 89200,
        rating: 4.8,
        isSubscribed: true
    },
    {
        id: '3',
        title: 'Mindful Moments',
        host: 'Dr. Emma Thompson',
        description: 'Daily meditation, mindfulness techniques, and wellness practices',
        coverUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop',
        category: 'Health & Wellness',
        totalEpisodes: 365,
        followers: 123000,
        rating: 4.7,
        isSubscribed: false
    },
    {
        id: '4',
        title: 'Comedy Central',
        host: 'Various',
        description: 'Funny stories, stand-up comedy, and humor from around the world',
        coverUrl: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=300&h=300&fit=crop',
        category: 'Comedy',
        totalEpisodes: 278,
        followers: 34000,
        rating: 4.5,
        isSubscribed: true
    },
    {
        id: '5',
        title: 'True Crime Stories',
        host: 'Detective Laura Mills',
        description: 'Investigating famous cases, unsolved mysteries, and Criminal psychology',
        coverUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop',
        category: 'True Crime',
        totalEpisodes: 67,
        followers: 156000,
        rating: 4.6,
        isSubscribed: false
    },
    {
        id: '6',
        title: 'Travel Tales',
        host: 'Jordan & Ryan',
        description: 'Adventures, hidden gems, and travel tips from around the globe',
        coverUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=300&h=300&fit=crop',
        category: 'Travel',
        totalEpisodes: 103,
        followers: 67000,
        rating: 4.4,
        isSubscribed: false
    },
    {
        id: '7',
        title: 'Business Breakthrough',
        host: 'David Chen',
        description: 'Entrepreneurial success stories, business strategies, and startup advice',
        coverUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=300&h=300&fit=crop',
        category: 'Business',
        totalEpisodes: 194,
        followers: 78000,
        rating: 4.7,
        isSubscribed: true
    },
    {
        id: '8',
        title: 'Science Simplified',
        host: 'Dr. Lisa Wang',
        description: 'Breaking down complex scientific concepts into easy-to-understand discussions',
        coverUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=300&h=300&fit=crop',
        category: 'Science',
        totalEpisodes: 156,
        followers: 95000,
        rating: 4.8,
        isSubscribed: false
    }
]

const latestEpisodes: Episode[] = [
    {
        id: 'ep1',
        podcastId: '2',
        title: 'AI Revolution: What GPT-5 Means for Developers',
        description: 'Exploring the latest advancements in AI development and their impact on coding careers',
        duration: '42min',
        publishDate: '2 days ago',
        coverUrl: 'https://via.placeholder.com/300x300?text=Tech+Unfiltered',
        playCount: 15200
    },
    {
        id: 'ep2',
        podcastId: '7',
        title: 'From Side Hustle to Full-Time CEO',
        description: 'A local entrepreneur shares their journey from part-time side project to successful startup',
        duration: '35min',
        publishDate: '3 days ago',
        coverUrl: 'https://via.placeholder.com/300x300?text=Business+Breakthrough',
        playCount: 9800
    },
    {
        id: 'ep3',
        podcastId: '4',
        title: 'Stand-Up Comedy in the Digital Age',
        description: 'How comedy is evolving with social media and online audiences',
        duration: '28min',
        publishDate: '4 days ago',
        coverUrl: 'https://via.placeholder.com/300x300?text=Comedy+Central',
        playCount: 23400
    },
    {
        id: 'ep4',
        podcastId: '5',
        title: 'The Missing Person Case Files',
        description: 'Analyzing unsolved disappearance cases and modern investigatory techniques',
        duration: '55min',
        publishDate: '5 days ago',
        coverUrl: 'https://via.placeholder.com/300x300?text=True+Crime',
        playCount: 45600
    },
    {
        id: 'ep5',
        podcastId: '8',
        title: 'Quantum Physics and Our Daily Reality',
        description: 'What quantum computing means for everyday technology users',
        duration: '38min',
        publishDate: '6 days ago',
        coverUrl: 'https://via.placeholder.com/300x300?text=Science+Simplified',
        playCount: 12100
    },
    {
        id: 'ep6',
        podcastId: '1',
        title: 'Indie Game Dev Opportunities in 2024',
        description: 'Resources, funding, and platforms for aspiring game developers',
        duration: '47min',
        publishDate: '1 week ago',
        coverUrl: 'https://via.placeholder.com/300x300?text=Game+Changers',
        playCount: 18700
    }
]

export const Podcasts: React.FC<PodcastsProps> = ({ onEpisodeSelect }) => {
    const [playingEpisodeId, setPlayingEpisodeId] = useState<string | null>(null)

    const handlePlayEpisode = (episode: Episode) => {
        const podcast = podcasts.find(p => p.id === episode.podcastId)
        if (playingEpisodeId === episode.id) {
            setPlayingEpisodeId(null)
            toast.info('Paused podcast')
        } else {
            setPlayingEpisodeId(episode.id)
            toast.success(`Now playing "${episode.title}"`)
            onEpisodeSelect?.(episode, podcast!)
        }
    }

    const toggleSubscription = (podcast: Podcast) => {
        if (podcast.isSubscribed) {
            toast.info(`Unsubscribed from ${podcast.title}`)
        } else {
            toast.success(`Subscribed to ${podcast.title}`)
        }
    }

    const handleLikeEpisode = (episode: Episode) => {
        toast.success('Added episode to favorites')
    }

    const handleShareEpisode = (episode: Episode) => {
        toast.success('Share link copied!')
    }

    const categories = ['All', 'Gaming', 'Technology', 'Health & Wellness', 'Comedy', 'True Crime', 'Travel', 'Business', 'Science']
    const [selectedCategory, setSelectedCategory] = useState('All')

    const filteredPodcasts = selectedCategory === 'All'
        ? podcasts
        : podcasts.filter(podcast => podcast.category === selectedCategory)

    return (
        <div className="p-6">
            {/* Categories */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Browse by Category</h2>
                <div className="flex space-x-2 overflow-x-auto pb-2">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${selectedCategory === category
                                ? 'bg-green-500 text-black'
                                : 'bg-gray-800 text-white hover:bg-gray-700'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Latest Episodes */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-6">
                    <Podcast className="text-purple-500" size={24} />
                    <h2 className="text-2xl font-bold">Latest Episodes</h2>
                </div>

                <div className="space-y-4">
                    {latestEpisodes.slice(0, 4).map((episode) => {
                        const podcast = podcasts.find(p => p.id === episode.podcastId)
                        return (
                            <div key={episode.id} className="flex items-center space-x-4 bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-all group">
                                <Image
                                    src={episode.coverUrl}
                                    alt={episode.title}
                                    width={80}
                                    height={80}
                                    className="w-20 h-20 rounded-lg flex-shrink-0"
                                />

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-lg mb-1 truncate">{episode.title}</h3>
                                    <p className="text-gray-400 mb-2">{podcast?.title}</p>
                                    <p className="text-sm text-gray-300 mb-2 line-clamp-2">{episode.description}</p>
                                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                                        <div className="flex items-center space-x-1">
                                            <Clock size={12} />
                                            <span>{episode.duration}</span>
                                        </div>
                                        <span>{episode.publishDate}</span>
                                        <div className="flex items-center space-x-1">
                                            <Users size={12} />
                                            <span>{episode.playCount.toLocaleString()} plays</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleLikeEpisode(episode)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Heart size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleShareEpisode(episode)}
                                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                    >
                                        <Share2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handlePlayEpisode(episode)}
                                        className="bg-green-500 text-black rounded-full p-3 hover:bg-green-400 transition-all group-hover:scale-105"
                                    >
                                        {playingEpisodeId === episode.id ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Popular Podcasts */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <Mic className="text-green-500" size={24} />
                        <h2 className="text-2xl font-bold">Popular Podcasts</h2>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors text-sm">
                        See all
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredPodcasts.map((podcast) => (
                        <div key={podcast.id} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-all group">
                            <div className="aspect-square mb-4 rounded-lg overflow-hidden">
                                <Image
                                    src={podcast.coverUrl}
                                    alt={podcast.title}
                                    width={300}
                                    height={300}
                                    className="w-full h-full object-cover"
                                />
                                {/* <button
                                    onClick={() => toast.success(`Now playing latest episode of ${podcast.title}`)}
                                    className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Play size={40} className="text-white" />
                                </button> */}
                            </div>

                            <h3 className="font-semibold text-lg mb-1">{podcast.title}</h3>
                            <p className="text-gray-400 text-sm mb-2">by {podcast.host}</p>
                            <p className="text-sm text-gray-300 mb-3 line-clamp-2">{podcast.description}</p>

                            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                                <span className="px-2 py-1 bg-gray-700 rounded-full text-xs">{podcast.category}</span>
                                <div className="flex items-center space-x-1">
                                    <Star size={12} className="text-yellow-500" />
                                    <span>{podcast.rating}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Users size={12} />
                                    <span>{podcast.followers.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => toggleSubscription(podcast)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${podcast.isSubscribed
                                        ? 'bg-gray-600 hover:bg-gray-500'
                                        : 'bg-green-500 text-black hover:bg-green-400'
                                        }`}
                                >
                                    {podcast.isSubscribed ? 'Subscribed' : 'Subscribe'}
                                </button>
                                <div className="flex space-x-2">
                                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                        <Heart size={16} />
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                                        <Share2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

interface RadioStation {
    id: string
    name: string
    description: string
    genre: string
    coverUrl: string
    listenerCount: number
    rating: number
    isLive: boolean
    currentShow?: string
}

interface LiveShow {
    stationId: string
    title: string
    host: string
    startTime: string
    endTime: string
    description: string
}

interface RadioProps {
    onStationSelect?: (station: RadioStation) => void
}

const stations: RadioStation[] = [
    {
        id: '1',
        name: 'Jazz Café',
        description: 'Smooth jazz from legends to modern masters',
        genre: 'Jazz',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        listenerCount: 15420,
        rating: 4.8,
        isLive: true,
        currentShow: '"Late Night Jazz" with Miles'
    },
    {
        id: '2',
        name: 'Rock Central',
        description: 'Classic rock anthems and modern hits',
        genre: 'Rock',
        coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop',
        listenerCount: 23450,
        rating: 4.9,
        isLive: true,
        currentShow: '"Rock Rewind" - Classic Hits'
    },
    {
        id: '3',
        name: 'Indie Vibes',
        description: 'Fresh indie tracks from emerging artists',
        genre: 'Indie',
        coverUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop',
        listenerCount: 8765,
        rating: 4.7,
        isLive: true,
        currentShow: '"Indie Showcase" - New Artists'
    },
    {
        id: '4',
        name: 'Electronic Beats',
        description: 'Deep house, techno, and EDM mixes',
        genre: 'Electronic',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
        listenerCount: 19876,
        rating: 4.6,
        isLive: true,
        currentShow: '"Club Nights" - DJ Set'
    },
    {
        id: '5',
        name: 'Classical Essence',
        description: 'Masterpieces from Bach to modern composers',
        genre: 'Classical',
        coverUrl: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300&h=300&fit=crop',
        listenerCount: 5432,
        rating: 4.5,
        isLive: false
    },
    {
        id: '6',
        name: 'Hip Hop Nation',
        description: 'Underground to mainstream hip hop',
        genre: 'Hip Hop',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        listenerCount: 32101,
        rating: 4.8,
        isLive: true,
        currentShow: '"Hip Hop Today" - New Releases'
    },
    {
        id: '7',
        name: 'Reggae Roots',
        description: 'Island vibes and reggae classics',
        genre: 'Reggae',
        coverUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop',
        listenerCount: 7643,
        rating: 4.4,
        isLive: true,
        currentShow: '"Island Sounds" - Caribbean Mix'
    },
    {
        id: '8',
        name: 'Country Road',
        description: 'Traditional and modern country music',
        genre: 'Country',
        coverUrl: 'https://images.unsplash.com/photo-1520637836862-4d197d17c90a?w=300&h=300&fit=crop',
        listenerCount: 18934,
        rating: 4.7,
        isLive: false
    },
    {
        id: '9',
        name: 'World Music',
        description: 'Global sounds and international artists',
        genre: 'World',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        listenerCount: 4321,
        rating: 4.3,
        isLive: true,
        currentShow: '"Around the World" - Global Mix'
    }
]

const liveShows: LiveShow[] = [
    {
        stationId: '1',
        title: 'Late Night Jazz',
        host: 'Miles Chen',
        startTime: '10:00 PM',
        endTime: '12:00 AM',
        description: 'Smooth jazz selections to help you unwind'
    },
    {
        stationId: '2',
        title: 'Rock Rewind',
        host: 'Anna Thompson',
        startTime: '9:00 PM',
        endTime: '11:00 PM',
        description: 'Classic rock hits from your favorite bands'
    },
    {
        stationId: '3',
        title: 'Indie Showcase',
        host: 'Mike Davis',
        startTime: '8:00 PM',
        endTime: '10:00 PM',
        description: 'Spotlighting up-and-coming indie artists'
    },
    {
        stationId: '4',
        title: 'Club Nights',
        host: 'DJ Vortex',
        startTime: '11:00 PM',
        endTime: '1:00 AM',
        description: 'High-energy electronic beats for the dance floor'
    }
]

export const Radio: React.FC<RadioProps> = ({ onStationSelect }) => {
    const [playingStationId, setPlayingStationId] = useState<string | null>(null)
    const [currentTrack, setCurrentTrack] = useState('')
    const handlePlayStation = (station: RadioStation) => {
        if (playingStationId === station.id) {
            setPlayingStationId(null)
            toast.info('Stopped radio')
        } else {
            setPlayingStationId(station.id)
            setCurrentTrack(`${station.name} - ${station.currentShow || 'Live Broadcast'}`)
            toast.success(`Now playing ${station.name}`)
            onStationSelect?.(station)
        }
    }

    const handleLikeStation = (station: RadioStation) => {
        toast.success(`Added "${station.name}" to favorites`)
    }

    const getCurrentShowForStation = (stationId: string) => {
        return liveShows.find(show => show.stationId === stationId)
    }

    return (
        <div className="p-6">
            {/* Featured Live Shows */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-6">
                    <RadioIcon className="text-red-500" size={24} />
                    <h2 className="text-2xl font-bold">Live Shows</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {liveShows.map((show) => {
                        const station = stations.find(s => s.id === show.stationId)
                        return (
                            <div key={show.stationId} className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-all group">
                                <div className="flex items-start space-x-4">
                                    <Image
                                        src={station?.coverUrl || ""}
                                        alt={station?.name || "Station cover"}
                                        width={80}
                                        height={80}
                                        className="w-20 h-20 rounded-lg"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                            <span className="text-sm text-red-500 font-semibold">LIVE</span>
                                        </div>
                                        <h3 className="font-bold text-lg mb-1">{show.title}</h3>
                                        <p className="text-gray-400 mb-2">Hosted by {show.host}</p>
                                        <p className="text-sm text-gray-300 mb-3">{show.description}</p>
                                        <div className="flex items-center space-x-4 text-sm text-gray-400">
                                            <Clock size={14} />
                                            <span>{show.startTime} - {show.endTime}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handlePlayStation(station!)}
                                        className="bg-green-500 text-black rounded-full p-3 hover:bg-green-400 transition-colors group-hover:scale-105"
                                    >
                                        <Play size={20} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Stations Grid */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <Globe className="text-blue-500" size={24} />
                        <h2 className="text-2xl font-bold">Radio Stations</h2>
                    </div>
                    <div className="flex space-x-4 text-sm">
                        <button className="px-4 py-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors">
                            All Stations
                        </button>
                        <button className="px-4 py-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors">
                            By Genre
                        </button>
                        <button className="px-4 py-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors">
                            Popular
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stations.map((station) => (
                        <div key={station.id} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-all group relative">
                            <div className="relative aspect-square mb-4 rounded-lg overflow-hidden">
                                <Image
                                    src={station.coverUrl}
                                    alt={station.name}
                                    width={300}
                                    height={300}
                                    className="w-full h-full object-cover"
                                />
                                {station.isLive && (
                                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                        <span>LIVE</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => handlePlayStation(station)}
                                    className="absolute bottom-4 right-4 bg-green-500 text-black rounded-full p-3 transition-all duration-300 hover:scale-110 shadow-lg"
                                >
                                    {playingStationId === station.id ? <Pause size={20} /> : <Play size={20} />}
                                </button>
                            </div>

                            <div className="flex-1">
                                <h3 className="font-semibold text-lg mb-1">{station.name}</h3>
                                <p className="text-gray-400 text-sm mb-2">{station.description}</p>
                                {station.currentShow && (
                                    <p className="text-red-400 text-sm font-medium mb-2">Now: {station.currentShow}</p>
                                )}

                                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                                    <div className="flex items-center space-x-3">
                                        <span>{station.genre}</span>
                                        <div className="flex items-center space-x-1">
                                            <Star size={12} className="text-yellow-500" />
                                            <span>{station.rating}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Users size={12} />
                                        <span>{station.listenerCount.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <button
                                        onClick={() => handleLikeStation(station)}
                                        className="flex items-center space-x-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Heart size={16} />
                                        <span className="text-sm">Like</span>
                                    </button>
                                    <button className="text-gray-400 hover:text-white transition-colors text-sm">
                                        Share
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Now Playing */}
            {playingStationId && (
                <div className="fixed bottom-20 left-0 right-0 mx-auto max-w-md bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700 z-30">
                    <div className="flex items-center space-x-3">
                        <Image
                            src={stations.find(s => s.id === playingStationId)?.coverUrl || ""}
                            alt="Now Playing"
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded"
                        />
                        <div className="flex-1">
                            <p className="font-semibold text-sm">Now Playing</p>
                            <p className="text-gray-400 text-xs">{currentTrack}</p>
                        </div>
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    </div>
                </div>
            )}
        </div>
    )
}

interface RecommendationCard {
    id: string
    title: string
    description: string
    coverUrl: string
    type: 'playlist' | 'artist' | 'album'
    trackCount?: number
}

interface Track {
    id: string
    title: string
    artist: string
    album: string
    coverUrl: string
}

interface RecommendationsProps {
    onTrackSelect: (track: Track) => void
}

const recommendations: RecommendationCard[] = [
    {
        id: '1',
        title: 'Indie Pop Discovery',
        description: 'Fresh indie tracks you\'ll love',
        coverUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
        type: 'playlist',
        trackCount: 45
    },
    {
        id: '2',
        title: 'Your Mix of Alt Rock',
        description: 'Alternative rock based on your taste',
        coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=200&h=200&fit=crop',
        type: 'playlist',
        trackCount: 52
    },
    {
        id: '3',
        title: 'BTS',
        description: 'Best recommendations based on your listening',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
        type: 'artist',
        trackCount: 89
    },
    {
        id: '4',
        title: 'Daily Mix 3',
        description: 'Electronic and indie favorites',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
        type: 'playlist',
        trackCount: 38
    },
    {
        id: '5',
        title: 'Release Radar',
        description: 'New music from artists you follow',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
        type: 'playlist',
        trackCount: 67
    },
    {
        id: '6',
        title: 'Weekly Indie',
        description: 'Trending indie tracks this week',
        coverUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
        type: 'playlist',
        trackCount: 42
    }
]

const sampleTrack: Track = {
    id: 'rec1',
    title: 'Featured Track',
    artist: 'Various Artists',
    album: 'Discovery',
    coverUrl: 'https://via.placeholder.com/150?text=Featured'
}

const handlePlayRecommendation = (rec: RecommendationCard) => {
    toast.success(`Playing ${rec.title}!`)
    // In a real app, this would play the first track of the recommended content
}

const handleLikeRecommendation = (rec: RecommendationCard) => {
    toast.success(`Added ${rec.title} to favorites!`)
}

export const Recommendations: React.FC<RecommendationsProps> = ({ onTrackSelect }) => {
    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Made For You</h2>
                <button className="text-gray-400 hover:text-white transition-colors text-sm">
                    See all
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                {recommendations.map((rec) => (
                    <div
                        key={rec.id}
                        className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group cursor-pointer"
                    >
                        <div className="relative mb-4">
                            <Image
                                src={rec.coverUrl}
                                alt={rec.title}
                                width={200}
                                height={200}
                                className="w-full aspect-square object-cover rounded-md mb-3"
                            />
                            <button
                                onClick={() => handlePlayRecommendation(rec)}
                                className="absolute bottom-2 right-2 bg-green-500 text-black rounded-full p-3 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                            >
                                <Play size={20} />
                            </button>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{rec.title}</h3>
                        <p className="text-gray-400 text-xs mb-2">{rec.description}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 text-xs capitalize">{rec.type}</span>
                            {rec.trackCount && (
                                <div className="flex items-center text-gray-500 text-xs">
                                    <Clock size={10} className="mr-1" />
                                    {rec.trackCount}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Listening Section */}
            <div className="mb-8">
                <h3 className="text-xl font-bold mb-4">Recently Played</h3>
                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center space-x-4 bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">
                        <Image
                            src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop"
                            alt="Recently Played"
                            width={64}
                            height={64}
                            className="w-16 h-16 rounded"
                        />
                        <div className="flex-1">
                            <h4 className="font-medium">Mellow Indie</h4>
                            <p className="text-gray-400 text-sm">Your playlist • 34 songs</p>
                        </div>
                        <button
                            onClick={() => onTrackSelect(sampleTrack)}
                            className="bg-green-500 text-black rounded-full p-2 hover:bg-green-400"
                        >
                            <Play size={16} />
                        </button>
                    </div>
                    <div className="flex items-center space-x-4 bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">
                        <Image
                            src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop"
                            alt="Recently Played"
                            width={64}
                            height={64}
                            className="w-16 h-16 rounded"
                        />
                        <div className="flex-1">
                            <h4 className="font-medium">Electronic Focus</h4>
                            <p className="text-gray-400 text-sm">Your playlist • 27 songs</p>
                        </div>
                        <button
                            onClick={() => onTrackSelect(sampleTrack)}
                            className="bg-green-500 text-black rounded-full p-2 hover:bg-green-400"
                        >
                            <Play size={16} />
                        </button>
                    </div>
                    <div className="flex items-center space-x-4 bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">
                        <img
                            src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop"
                            alt="Recently Played"
                            className="w-16 h-16 rounded"
                        />
                        <div className="flex-1">
                            <h4 className="font-medium">Late Night Vibes</h4>
                            <p className="text-gray-400 text-sm">Your playlist • 19 songs</p>
                        </div>
                        <button
                            onClick={() => onTrackSelect(sampleTrack)}
                            className="bg-green-500 text-black rounded-full p-2 hover:bg-green-400"
                        >
                            <Play size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface SidebarProps {
    onNavigate: (section: string) => void
    currentSection: string
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, currentSection }) => {
    const menuItems = [
        { icon: Home, label: 'Home', key: 'home' },
        { icon: Sparkles, label: 'Made for You', key: 'recommendations' },
        { icon: Compass, label: 'Discover', key: 'discover' },
        { icon: ListMusic, label: 'Playlists', key: 'playlists' },
        { icon: RadioIcon, label: 'Radio', key: 'radio' },
        { icon: Users, label: 'Friends', key: 'friends' },
        { icon: Podcast, label: 'Podcasts', key: 'podcasts' }
    ]

    return (
        <aside className="w-64 bg-gray-800 p-4 space-y-6">
            <div className="text-2xl font-bold text-green-500 mb-8">
                VibeStream
            </div>
            <nav>
                {menuItems.map((item, index) => (
                    <div
                        key={index}
                        onClick={() => onNavigate(item.key)}
                        className={`flex items-center space-x-4 p-3 rounded-lg transition-colors cursor-pointer ${currentSection === item.key
                            ? 'bg-gray-700 text-white'
                            : 'hover:bg-gray-700'
                            }`}
                    >
                        <item.icon className={`text-gray-300 ${currentSection === item.key ? 'text-white' : ''}`} size={24} />
                        <span className={currentSection === item.key ? 'text-white' : ''}>{item.label}</span>
                    </div>
                ))}
            </nav>
        </aside>
    )
}

interface Activity {
    id: string
    user: {
        name: string
        avatar: string
    }
    type: 'liked' | 'shared' | 'commented' | 'listened'
    track?: {
        title: string
        artist: string
        coverUrl: string
    }
    timestamp: string
    message?: string
}

const sampleActivities: Activity[] = [
    {
        id: '1',
        user: { name: 'Alex Johnson', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face' },
        type: 'liked',
        track: {
            title: 'Blinding Lights',
            artist: 'The Weeknd',
            coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop'
        },
        timestamp: '2 minutes ago'
    },
    {
        id: '2',
        user: { name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face' },
        type: 'shared',
        track: {
            title: 'Dance Monkey',
            artist: 'Tones and I',
            coverUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop'
        },
        timestamp: '5 minutes ago',
        message: 'This song gets me moving every time! ❤️'
    },
    {
        id: '3',
        user: { name: 'Mike Rodriguez', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face' },
        type: 'commented',
        track: {
            title: 'Bad Guy',
            artist: 'Billie Eilish',
            coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop'
        },
        timestamp: '10 minutes ago',
        message: 'The lyrics on this track are genius!'
    },
    {
        id: '4',
        user: { name: 'Emma Wilson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face' },
        type: 'listened',
        track: {
            title: 'Everything You Want',
            artist: 'Vertical Horizon',
            coverUrl: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?ixlib=rb-1.2.1&auto=format&fit=crop&w=60&h=60&q=80'
        },
        timestamp: '15 minutes ago'
    }
];

const getActivityIcon = (type: string) => {
    switch (type) {
        case 'liked': return <Heart className="text-red-500" size={16} />
        case 'shared': return <Share className="text-blue-500" size={16} />
        case 'commented': return <MessageCircle className="text-green-500" size={16} />
        case 'listened': return <Music className="text-purple-500" size={16} />
        default: return <Music className="text-gray-500" size={16} />
    }
}

const getActivityText = (activity: Activity) => {
    switch (activity.type) {
        case 'liked': return `liked "${activity.track?.title}"`
        case 'shared': return `shared "${activity.track?.title}"`
        case 'commented': return `commented on "${activity.track?.title}"`
        case 'listened': return `is listening to "${activity.track?.title}"`
        default: return `is listening to music`
    }
}

export const SocialFeed: React.FC = () => {
    return (
        <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
                <Users className="text-blue-500" size={24} />
                <h2 className="text-2xl font-bold">Friends Activity</h2>
            </div>

            <div className="space-y-4">
                {sampleActivities.map((activity) => (
                    <div key={activity.id} className="flex space-x-4 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                        <Image
                            src={activity.user.avatar}
                            alt={activity.user.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full"
                        />

                        <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold">{activity.user.name}</span>
                                {getActivityIcon(activity.type)}
                                <span className="text-gray-300">{getActivityText(activity)}</span>
                            </div>

                            {activity.track && (
                                <div className="flex items-center space-x-3 mb-2 bg-gray-900 rounded-md p-3">
                                    <Image
                                        src={activity.track.coverUrl}
                                        alt={activity.track.title}
                                        width={48}
                                        height={48}
                                        className="w-12 h-12 rounded"
                                    />
                                    <div>
                                        <h4 className="font-medium text-sm">{activity.track.title}</h4>
                                        <p className="text-gray-400 text-sm">{activity.track.artist}</p>
                                    </div>
                                </div>
                            )}

                            {activity.message && (
                                <p className="text-gray-300 italic mb-2">&ldquo;{activity.message}&rdquo;</p>
                            )}

                            <p className="text-gray-500 text-sm">{activity.timestamp}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 text-center">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full transition-colors">
                    Load More Activity
                </button>
            </div>
        </div>
    )
}

const App: React.FC = () => {
    const [currentSection, setCurrentSection] = useState('home')
    const [currentTrack, setCurrentTrack] = useState({
        id: 'initial',
        title: 'Welcome to VibeStream',
        artist: 'Your Music Journey',
        album: 'Discover',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop'
    })

    const renderMainContent = () => {
        switch (currentSection) {
            case 'home':
                return (
                    <>
                        <h1 className="text-3xl font-bold p-6">Your Music Library</h1>
                        <AlbumGrid onTrackSelect={setCurrentTrack} />
                    </>
                )
            case 'recommendations':
                return <Recommendations onTrackSelect={setCurrentTrack} />
            case 'discover':
                return <Discover onTrackSelect={setCurrentTrack} />
            case 'radio':
                return <Radio />
            case 'podcasts':
                return <Podcasts />
            case 'friends':
                return (
                    <div className="p-6">
                        <h1 className="text-3xl font-bold mb-6">Friends Activity</h1>
                        <div className="max-w-2xl">
                            <FriendsList currentTrack={currentTrack} />
                        </div>
                    </div>
                )
            default:
                return (
                    <>
                        <h1 className="text-3xl font-bold p-6">Your Music Library</h1>
                        <AlbumGrid onTrackSelect={setCurrentTrack} />
                    </>
                )
        }
    }

    return (
        <div className="h-[94vh] bg-gray-900 text-white flex">
            <Sidebar onNavigate={setCurrentSection} currentSection={currentSection} />
            <main className="flex-1 overflow-y-scroll bg-gradient-to-b from-gray-800 to-gray-900 pb-40">
                <Header />
                <div className="flex">
                    <div className="flex-1">
                        {renderMainContent()}
                    </div>
                </div>
                <SocialFeed />
            </main>
            <MusicPlayer currentTrack={currentTrack} />
        </div>
    )
}

export default App