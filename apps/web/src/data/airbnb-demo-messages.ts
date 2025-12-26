
import { UIMessage } from "@ai-sdk/react";

export const AIRBNB_DEMO_STEPS: UIMessage[] = [
    {
        "id": "cmfvoa6030019yl8p1vh93g36",
        "role": "user",
        "parts": [
            {
                "text": "Build a platform for real estate listings (Airbnb-like)",
                "type": "text"
            }
        ],
    },
    {
        "id": "cmfvoh55z001byl8pajszgouo",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "I'll create an Airbnb clone with React and Shadcn/ui featuring:\n• Property listings with search\n• User authentication\n• Booking system\n• Modern violet theme design",
                "state": "done"
            },
            {
                "type": "step-start"
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Validating project setup:",
                "state": "done"
            },
            {
                "type": "tool-validateProject",
                "toolCallId": "toolu_vrtx_01M4Neuo47bCNRGGNkC5wCDw",
                "state": "output-available",
                "input": {
                    "showLogs": true,
                    "checkContentCompleteness": true
                },
                "output": {
                    "success": true,
                    "timestamp": "2025-09-22T22:07:51.113Z"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Getting preview URL:",
                "state": "done"
            },
            {
                "type": "tool-getSandboxUrl",
                "toolCallId": "toolu_vrtx_017uBnsgq87q5W5GwkwSMBGz",
                "state": "output-available",
                "input": {},
                "output": {
                    "type": "sandbox",
                    "url": "//demo",
                    "message": "Sandbox is available at: //demo"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Finalizing project:",
                "state": "done"
            },
            {
                "type": "tool-finalizeWorkingFragment",
                "toolCallId": "toolu_vrtx_012VW2mBfjwgGay9JKrQLbqn",
                "state": "output-available",
                "input": {
                    "title": "Created NomadNest Airbnb Clone with Featured Listings"
                },
                "output": {
                    "success": true,
                    "fragmentId": "4f672cdf-2fe6-424d-8841-976f0b405ccd",
                    "gitFragmentId": null,
                    "commitHash": null,
                    "title": "Created NomadNest Airbnb Clone with Featured Listings",
                    "message": "Working fragment finalized as: \"Created NomadNest Airbnb Clone with Featured Listings\" (no changes to commit)"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "✨ Airbnb clone complete! Features:\n• Responsive header with search\n• Property listings grid\n• Modern violet theme\n• Ready for bookings and auth",
                "state": "done"
            }
        ],
    },
    {
        "id": "cmfvontrf0005ylox5mz12z7j",
        "role": "user",
        "parts": [
            {
                "text": "Add User Authentication",
                "type": "text"
            }
        ],
    },
    {
        "id": "cmfvopthr0007yloxt1styncb",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Adding user authentication system:",
                "state": "done"
            },
            {
                "type": "tool-readFile",
                "toolCallId": "call_77414945",
                "state": "output-available",
                "input": {
                    "path": "src/App.tsx"
                },
                "output": ""
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-readFile",
                "toolCallId": "call_77366733",
                "state": "output-available",
                "input": {
                    "path": "src/components/Header.tsx"
                },
                "output": ""
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Creating auth context:",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_59438824",
                "state": "output-available",
                "input": {
                    "path": "src/contexts/AuthContext.tsx",
                    "content": "",
                    "description": "Create authentication context with login, register, and logout functionality"
                },
                "output": {
                    "success": true,
                    "path": "src/contexts/AuthContext.tsx",
                    "action": "created",
                    "description": "Create authentication context with login, register, and logout functionality",
                    "size": 3073,
                    "message": "Successfully created src/contexts/AuthContext.tsx"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Adding login modal:",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_67233559",
                "state": "output-available",
                "input": {
                    "path": "src/components/LoginModal.tsx",
                    "content": "",
                    "description": "Create login modal with form validation and authentication"
                },
                "output": {
                    "success": true,
                    "path": "src/components/LoginModal.tsx",
                    "action": "created",
                    "description": "Create login modal with form validation and authentication",
                    "size": 3756,
                    "message": "Successfully created src/components/LoginModal.tsx"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Creating signup modal:",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_80995956",
                "state": "output-available",
                "input": {
                    "path": "src/components/SignupModal.tsx",
                    "content": "",
                    "description": "Create signup modal with form validation and user registration"
                },
                "output": {
                    "success": true,
                    "path": "src/components/SignupModal.tsx",
                    "action": "created",
                    "description": "Create signup modal with form validation and user registration",
                    "size": 5121,
                    "message": "Successfully created src/components/SignupModal.tsx"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Adding user menu:",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_25916415",
                "state": "output-available",
                "input": {
                    "path": "src/components/UserMenu.tsx",
                    "content": "",
                    "description": "Create user menu dropdown with profile options and logout"
                },
                "output": {
                    "success": true,
                    "path": "src/components/UserMenu.tsx",
                    "action": "created",
                    "description": "Create user menu dropdown with profile options and logout",
                    "size": 2511,
                    "message": "Successfully created src/components/UserMenu.tsx"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "✨ Authentication system ready!",
                "state": "done"
            }
        ],
    },
    {
        "id": "cmfvoymcg000jyloxda96bxob",
        "role": "user",
        "parts": [
            {
                "text": "Add Booking System",
                "type": "text"
            }
        ]
    },
    {
        "id": "cmfvp13gt000lyloxpstf2qr6",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Adding booking system to the app:",
                "state": "done"
            },
            {
                "type": "tool-readFile",
                "toolCallId": "call_74563877",
                "state": "output-available",
                "input": {
                    "path": "src/App.tsx"
                },
                "output": "import React from 'react';\nimport { Toaster } from 'sonner';\nimport Header from './components/Header';\nimport FeaturedListings from './components/FeaturedListings';\nimport Footer from './components/Footer';\n\nconst App: React.FC = () => {\n  return (\n    <div className=\"min-h-screen bg-white flex flex-col\">\n      <Header />\n      \n      <main className=\"flex-grow\">\n        <FeaturedListings />\n        {/* Placeholder sections for other features */}\n        <section className=\"container mx-auto px-4 py-12 text-center bg-violet-50\">\n          <h2 className=\"text-3xl font-bold text-violet-900 mb-4\">Discover Your Next Adventure</h2>\n          <p className=\"text-gray-700 max-w-2xl mx-auto\">\n            From city apartments to countryside retreats, find unique spaces that feel like home.\n          </p>\n        </section>\n      </main>\n      \n      <Footer />\n      <Toaster richColors position=\"top-right\" />\n    </div>\n  );\n};\n\nexport default App;"
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-getFiles",
                "toolCallId": "call_19057456",
                "state": "output-available",
                "input": {},
                "output": {}
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-getFiles",
                "toolCallId": "call_48072825",
                "state": "output-available",
                "input": {},
                "output": {}
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-readFile",
                "toolCallId": "call_30738891",
                "state": "output-available",
                "input": {
                    "path": "src/components/FeaturedListings.tsx"
                },
                "output": ""
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Creating booking context:",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_68910280",
                "state": "output-available",
                "input": {
                    "path": "src/contexts/BookingContext.tsx",
                    "content": "",
                    "description": "Create booking context to manage listings and bookings state"
                },
                "output": {
                    "success": true,
                    "path": "src/contexts/BookingContext.tsx",
                    "action": "created",
                    "description": "Create booking context to manage listings and bookings state",
                    "size": 6410,
                    "message": "Successfully created src/contexts/BookingContext.tsx"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Adding booking modal:",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_32706859",
                "state": "output-available",
                "input": {
                    "path": "src/components/BookingModal.tsx",
                    "content": "",
                    "description": "Create booking modal with date selection, guest count, and pricing"
                },
                "output": {
                    "success": true,
                    "path": "src/components/BookingModal.tsx",
                    "action": "created",
                    "description": "Create booking modal with date selection, guest count, and pricing",
                    "size": 6186,
                    "message": "Successfully created src/components/BookingModal.tsx"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "Creating bookings view:",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_30456222",
                "state": "output-available",
                "input": {
                    "path": "src/components/MyBookings.tsx",
                    "content": "",
                    "description": "Create my bookings component to display user bookings with status and actions"
                },
                "output": {
                    "success": false,
                    "path": "src/components/MyBookings.tsx",
                    "action": "failed",
                    "description": "Create my bookings component to display user bookings with status and actions",
                    "error": "\"Operation timed out\"",
                    "message": "Failed to process src/components/MyBookings.tsx: \"Operation timed out\""
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "call_53062056",
                "state": "output-available",
                "input": {
                    "path": "src/components/MyBookings.tsx",
                    "content": "import React from 'react';\nimport { Calendar, MapPin, DollarSign, X, Star } from 'lucide-react';\nimport { Card, CardContent } from '@/components/ui/card';\nimport { Button } from '@/components/ui/button';\nimport { useBooking } from '@/contexts/BookingContext';\n\nconst MyBookings: React.FC = () => {\n  const { bookings, cancelBooking } = useBooking();\n\n  const getStatusColor = (status: string) => {\n    switch (status) {\n      case 'confirmed':\n        return 'bg-green-100 text-green-800';\n      case 'pending':\n        return 'bg-yellow-100 text-yellow-800';\n      case 'cancelled':\n        return 'bg-red-100 text-red-800';\n      case 'completed':\n        return 'bg-gray-100 text-gray-800';\n      default:\n        return 'bg-gray-100 text-gray-800';\n    }\n  };\n\n  const handleCancel = async (bookingId: string) => {\n    if (window.confirm('Are you sure you want to cancel this booking?')) {\n      await cancelBooking(bookingId);\n    }\n  };\n\n  if (bookings.length === 0) {\n    return (\n      <div className=\"container mx-auto px-4 py-12 text-center\">\n        <div className=\"max-w-md mx-auto space-y-4\">\n          <Calendar className=\"mx-auto h-16 w-16 text-gray-300\" />\n          <h2 className=\"text-2xl font-bold text-gray-900\">No bookings yet</h2>\n          <p className=\"text-gray-600\">\n            You haven't made any bookings. Start exploring amazing places to stay!\n          </p>\n        </div>\n      </div>\n    );\n  }\n\n  return (\n    <div className=\"container mx-auto px-4 py-8\">\n      <div className=\"mb-8\">\n        <h1 className=\"text-3xl font-bold text-violet-900 mb-2\">My Bookings</h1>\n        <p className=\"text-gray-600\">Manage your upcoming and past stays</p>\n      </div>\n\n      <div className=\"grid gap-6 md:grid-cols-2 lg:grid-cols-3\">\n        {[...bookings].reverse().map((booking) => (\n          <Card key={booking.id} className=\"overflow-hidden\">\n            <div className=\"aspect-video relative overflow-hidden\">\n              <img\n                src={booking.listing.imageUrl}\n                alt={booking.listing.title}\n                className=\"w-full h-full object-cover\"\n              />\n              <div className=\"absolute top-4 right-4\">\n                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(booking.status)}`}>\n                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}\n                </span>\n              </div>\n            </div>\n\n            <CardContent className=\"p-6\">\n              <h3 className=\"font-semibold text-lg mb-2\">{booking.listing.title}</h3>\n\n              <div className=\"space-y-2 mb-4\">\n                <div className=\"flex items-center text-sm text-gray-600\">\n                  <MapPin className=\"mr-1 h-4 w-4\" />\n                  {booking.listing.location}\n                </div>\n\n                <div className=\"flex items-center text-sm text-gray-600\">\n                  <Calendar className=\"mr-1 h-4 w-4\" />\n                  {booking.checkIn.toLocaleDateString()} - {booking.checkOut.toLocaleDateString()}\n                </div>\n              </div>\n\n              <div className=\"flex items-center justify-between\">\n                <div className=\"text-lg font-bold text-violet-800\">\n                  <DollarSign className=\"inline h-4 w-4\" />\n                  {booking.totalPrice}\n                </div>\n\n                {booking.status === 'confirmed' && new Date(booking.checkIn) > new Date() && (\n                  <Button\n                    variant=\"destructive\"\n                    size=\"sm\"\n                    onClick={() => handleCancel(booking.id)}\n                    className=\"text-xs\"\n                  >\n                    <X className=\"mr-1 h-3 w-3\" />\n                    Cancel\n                  </Button>\n                )}\n              </div>\n            </CardContent>\n          </Card>\n        ))}\n      </div>\n    </div>\n  );\n};\n\nexport default MyBookings;",
                    "description": "Create my bookings component to display user bookings"
                },
                "output": {
                    "success": true,
                    "path": "src/components/MyBookings.tsx",
                    "action": "created",
                    "description": "Create my bookings component to display user bookings",
                    "size": 3916,
                    "message": "Successfully created src/components/MyBookings.tsx"
                }
            },
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "✨ Booking system complete! Users can now:• Book properties with date selection • View their bookings • Cancel reservations",
                "state": "done"
            }
        ]
    }
]
    