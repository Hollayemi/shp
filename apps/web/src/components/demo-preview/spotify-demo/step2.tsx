import React from 'react'
import Image from 'next/image'
import { Play, Share2, Heart, MessageCircle } from 'lucide-react'
import { Users, MoreVertical, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Search, Bell, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import {
    Pause,
    SkipForward,
    SkipBack,
    Repeat,
    Shuffle,
    Volume2
} from 'lucide-react'
import {
    Home,
    ListMusic,
    Radio,
    Podcast,
    Library
} from 'lucide-react'
import { Music, Share } from 'lucide-react'
import { Toaster } from 'sonner'


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
    }
];

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

interface SidebarProps {
    onNavigate: (section: string) => void
    currentSection: string
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, currentSection }) => {
    const menuItems = [
        { icon: Home, label: 'Home', key: 'home' },
        { icon: ListMusic, label: 'Playlists', key: "Playlists" },
        { icon: Users, label: 'Friends', key: 'friends' },

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
                        <item.icon className="text-gray-300" size={24} />
                        <span>{item.label}</span>
                    </div>
                ))}
            </nav>
            <div className="border-t border-gray-700 pt-6">
                <div className="text-sm text-gray-400">Your Libraries</div>
                <div className="flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
                    <Library className="text-gray-300" size={24} />
                    <span>Music Library</span>
                </div>
            </div>
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
            case 'friends':
                return (
                    <div className="p-6">
                        <h1 className="text-3xl font-bold mb-6">Friends List</h1>
                        <div className="max-w-full">
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
            <main className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-800 to-gray-900 pb-20">
                <Header />
                <div className="flex">
                    <div className="flex-1">
                        {renderMainContent()}
                        <SocialFeed />
                    </div>
                </div>
            </main>
            <MusicPlayer currentTrack={currentTrack} />
        </div>
    )
}

export default App