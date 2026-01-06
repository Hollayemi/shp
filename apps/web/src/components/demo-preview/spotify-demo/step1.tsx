import React, { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import Image from 'next/image'
import { Search, Bell, User } from 'lucide-react'
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    Repeat,
    Shuffle,
    Volume2,
    Home,
    ListMusic,
    Radio,
    Heart,
    Podcast,
    Library
} from 'lucide-react'

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


export const AlbumGrid: React.FC<AlbumGridProps> = ({ onTrackSelect }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 ">Popular Tracks</h2>
            <div className="grid grid-cols-2 @md:grid-cols-3 gap-6">
                {sampleTracks.map((track) => (
                    <div
                        key={track.id}
                        className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group relative"
                    >
                        <Image
                            src={track.coverUrl}
                            alt={track.title}
                            width={150}
                            height={150}
                            className="w-full rounded-md mb-4 shadow-lg"
                        />
                        <div className="text-sm">
                            <h3 className="font-semibold">{track.title}</h3>
                            <p className="text-gray-400">{track.artist}</p>
                        </div>
                        <button
                            onClick={() => onTrackSelect(track)}
                            className="absolute bottom-4 right-4 bg-green-500 text-black rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Play size={20} />
                        </button>
                    </div>
                ))}
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


export const Sidebar: React.FC = () => {
    const menuItems = [
        { icon: Home, label: 'Home' },
        { icon: ListMusic, label: 'Playlists' },
        // { icon: Radio, label: 'Radio' },
        // { icon: Heart, label: 'Favorites' },
        // { icon: Podcast, label: 'Podcasts' }
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
                        className="flex items-center space-x-4 p-3 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
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


const App: React.FC = () => {
    const [currentTrack, setCurrentTrack] = useState({
        id: 'initial',
        title: 'Welcome to VibeStream',
        artist: 'Your Music Journey',
        album: 'Discover',
        coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop'
    })

    return (
        <div className="h-[94vh] bg-gray-900 text-white flex">
            <Sidebar />
            <main className="flex-1 h-[calc(100vh-80px)] overflow-y-scroll bg-gradient-to-b from-gray-800 to-gray-900">
                <Header />
                <h1 className="text-3xl font-bold p-6">Your Music Library</h1>
                <AlbumGrid onTrackSelect={setCurrentTrack} />
            </main>
            <MusicPlayer currentTrack={currentTrack} />
        </div>
    )
}

export default App