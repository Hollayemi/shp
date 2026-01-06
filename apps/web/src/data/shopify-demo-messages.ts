import { UIMessage } from "@ai-sdk/react";

export const SPOTIFY_DEMO_STEPS: UIMessage[] = [
    {
        "id": "cmfuxjd2m0007yl7bk4zq5jv6",
        "role": "user",
        "parts": [
            {
                "text": "Build a spotify-like app",
                "type": "text"
            }
        ],
    },
    {
        "id": "cmfuxpiwk0009yl7bs9d1vq9g",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Building Spotify like app with React + Vite.\n\n**Features**\n- Music library with album views\n- Player controls and track switching\n- Search functionality\n\n**Design**\n- Dark theme with gradients\n- Responsive grid layout\n- Lucide icons",
                "state": "done"
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-validateProject",
                "toolCallId": "toolu_01XUENeK7KumZzxoyx7cpmhZ",
                "state": "output-available",
                "input": {
                    "showLogs": false,
                    "checkContentCompleteness": true
                },
                "output": {
                    "success": true,
                    "summary": {
                        "totalChecks": 7,
                        "passedChecks": 7,
                        "totalIssues": 0
                    }
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-finalizeWorkingFragment",
                "toolCallId": "toolu_01TNthhjrwbWHXrdmgsQbEJs",
                "state": "output-available",
                "input": {
                    "title": "VibeStream - Core Features"
                },
                "output": {
                    "success": true,
                    "fragmentId": "4049795c-fc5a-4f55-b019-c1dbf430fbc1",
                    "commitHash": "1be451a1c39a07bac50c1d151f481967df6867cc"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-getSandboxUrl",
                "toolCallId": "toolu_vrtx_019B7No1g8Euabo1ptgwXVL4",
                "state": "output-available",
                "input": {},
                "output": {
                    "type": "sandbox",
                    "url": "http://5173-ec394d42-1065-4806-84e0-a70620a2bea0.localhost:1234/"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "VibeStream ready!\n\n**Added:**\n- Sidebar navigation\n- Album grid with tracks\n- Music player controls\n- Dark theme UI\n\n",
                "state": "done"
            }
        ],
    },
    {
        "id": "cmfva0hv0000fyl7bowgjkty8",
        "role": "user",
        "parts": [
            {
                "text": "Add social features for sharing music with friends",
                "type": "text"
            }
        ],
    },
    {
        "id": "cmfva7m5n000hyl7b5e9ha3nr",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "reasoning",
                "text": "Adding social features: share buttons, friends list, and activity feed.",
                "state": "done"
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_16677363",
                "state": "output-available",
                "input": {
                    "path": "src/components/AlbumGrid.tsx",
                    "description": "Add share, like, and comment buttons to tracks"
                },
                "output": {
                    "success": true,
                    "path": "src/components/AlbumGrid.tsx",
                    "action": "created",
                    "size": 3969
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_54325860",
                "state": "output-available",
                "input": {
                    "path": "src/components/SocialFeed.tsx",
                    "description": "Create activity feed for friends' music interactions"
                },
                "output": {
                    "success": true,
                    "path": "src/components/SocialFeed.tsx",
                    "action": "created",
                    "size": 4580
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_92870285",
                "state": "output-available",
                "input": {
                    "path": "src/components/FriendsList.tsx",
                    "description": "Friends sidebar with online status"
                },
                "output": {
                    "success": true,
                    "path": "src/components/FriendsList.tsx",
                    "action": "created",
                    "size": 4118
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-finalizeWorkingFragment",
                "toolCallId": "call_35810499",
                "state": "output-available",
                "input": {
                    "title": "Social Features Added"
                },
                "output": {
                    "success": true,
                    "fragmentId": "b2f1a5f2-6fa2-49b0-bd59-c09c31fa31d2",
                    "commitHash": "1be451a1c39a07bac50c1d151f481967df6867cc"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Social features added!\n\n**New Features:**\n- Share tracks with friends\n- Like and comment on music\n- Friends activity feed\n- Online status indicators\n\n",
                "state": "done"
            }
        ],
    },
    {
        "id": "cmfval8ah000tyl7bs1leyi7u",
        "role": "user",
        "parts": [
            {
                "text": "Add music discovery and recommendations",
                "type": "text"
            }
        ],
    },
    {
        "id": "cmfvaoeom000vyl7bfye5pbe8",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "reasoning",
                "text": "Adding personalized recommendations and discovery features.",
                "state": "done"
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_07744700",
                "state": "output-available",
                "input": {
                    "path": "src/components/Recommendations.tsx",
                    "description": "Personalized playlists and recommendations"
                },
                "output": {
                    "success": true,
                    "path": "src/components/Recommendations.tsx",
                    "action": "created",
                    "size": 6598
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_46076695",
                "state": "output-available",
                "input": {
                    "path": "src/components/Discover.tsx",
                    "description": "Trending music, genres, and new releases"
                },
                "output": {
                    "success": true,
                    "path": "src/components/Discover.tsx",
                    "action": "created",
                    "size": 8736
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-finalizeWorkingFragment",
                "toolCallId": "call_49748466",
                "state": "output-available",
                "input": {
                    "title": "Discovery & Recommendations Added"
                },
                "output": {
                    "success": true,
                    "fragmentId": "45f9bc54-0e51-440c-bfd2-271870d268fe",
                    "commitHash": "1be451a1c39a07bac50c1d151f481967df6867cc"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Discovery system added!\n\n**Features:**\n- Personalized recommendations\n- Trending tracks and genres\n- New releases section\n- Radio stations by mood\n\n",
                "state": "done"
            }
        ],
    },
    {
        "id": "cmfvb4cf20017yl7bwpnhrgh7",
        "role": "user",
        "parts": [
            {
                "text": "Add live radio stations and podcasts",
                "type": "text"
            }
        ],
    },
    {
        "id": "cmfvb70h60019yl7bfdcpbhbe",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "reasoning",
                "text": "Adding live radio stations and podcast features with subscriptions.",
                "state": "done"
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_51174822",
                "state": "output-available",
                "input": {
                    "path": "src/components/Radio.tsx",
                    "description": "Live radio stations with schedules"
                },
                "output": {
                    "success": true,
                    "path": "src/components/Radio.tsx", 
                    "action": "created",
                    "size": 7245
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_54113493",
                "state": "output-available",
                "input": {
                    "path": "src/components/Podcasts.tsx",
                    "description": "Podcast library with episodes and subscriptions"
                },
                "output": {
                    "success": true,
                    "path": "src/components/Podcasts.tsx",
                    "action": "created", 
                    "size": 8942
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-finalizeWorkingFragment",
                "toolCallId": "call_final_radio",
                "state": "output-available",
                "input": {
                    "title": "Radio & Podcasts Complete"
                },
                "output": {
                    "success": true,
                    "fragmentId": "79be8949-5eb7-40a1-892e-edd4235b6983",
                    "commitHash": "1be451a1c39a07bac50c1d151f481967df6867cc"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Radio & Podcasts added!\n\n**Features:**\n- Live radio with LIVE indicators\n- Podcast episodes and subscriptions\n- Show schedules and ratings\n- Category browsing\n",
                "state": "done"
            }
        ],
    }
]