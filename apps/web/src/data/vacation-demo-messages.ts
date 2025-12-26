
import { UIMessage } from "@ai-sdk/react";

export const VACATION_DEMO_STEPS: UIMessage[] = [
    {
        "id": "msg_001",
        "role": "user",
        "parts": [
            {
                "text": "Build an internal employee vacation tracker app",
                "type": "text"
            }
        ],
    },
    {
        "id": "msg_002",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "I'll create a comprehensive employee vacation tracker with dashboard, request management, and calendar views. Let me start with the core structure and employee dashboard.",
                "state": "done"
            },
            {
                "type": "reasoning",
                "text": "For an internal vacation tracker, I need to focus on:\n- Employee self-service dashboard\n- Manager approval workflows\n- HR reporting capabilities\n- Clean, professional interface suitable for corporate use",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "toolu_01VacationDashboard",
                "state": "output-available",
                "input": {
                    "path": "src/components/VacationDashboard.tsx",
                    "description": "Employee dashboard with vacation balance and overview"
                },
                "output": {
                    "success": true,
                    "path": "src/components/VacationDashboard.tsx",
                    "action": "created",
                    "description": "Employee dashboard with vacation balance and overview"
                }
            }
        ]
    },
    {
        "id": "msg_003",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "text",
                "text": "VacationTracker ready!\n\n**Added:**\n- Employee dashboard with vacation balance\n- Quick stats and upcoming time off\n- Recent requests overview\n- Clean, professional UI\n\n",
                "state": "done"
            }
        ]
    },
    {
        "id": "msg_004",
        "role": "user",
        "parts": [
            {
                "text": "Add vacation request form and approval workflow",
                "type": "text"
            }
        ],
    },
    {
        "id": "msg_005",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "reasoning",
                "text": "The request workflow needs to handle different approval levels and prevent conflicts. I'll add form validation and status tracking.",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "toolu_01RequestForm",
                "state": "output-available",
                "input": {
                    "path": "src/components/RequestForm.tsx",
                    "description": "Vacation request form with validation"
                },
                "output": {
                    "success": true,
                    "path": "src/components/RequestForm.tsx",
                    "action": "created",
                    "description": "Vacation request form with validation"
                }
            },
            {
                "type": "text",
                "text": "Request system enhanced!\n\n**New Features:**\n- Vacation request form with date picker\n- Manager approval workflow\n- Request status tracking\n- Email notifications\n\n"
            }
        ],
    },
    {
        "id": "msg_006",
        "role": "user",
        "parts": [
            {
                "text": "Add team calendar view and manager dashboard",
                "type": "text"
            }
        ]
    },
    {
        "id": "msg_007",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "toolu_01TeamCalendar",
                "state": "output-available",
                "input": {
                    "path": "src/components/TeamCalendar.tsx",
                    "description": "Interactive calendar showing team vacation schedules"
                },
                "output": {
                    "success": true,
                    "path": "src/components/TeamCalendar.tsx",
                    "action": "created",
                    "description": "Interactive calendar showing team vacation schedules"
                }
            },
            {
                "type": "text",
                "text": "Team management added!\n\n**Features:**\n- Interactive team calendar\n- Manager dashboard with pending approvals\n- Team vacation overview\n- Conflict detection\n\n",
                "state": "done"
            }
        ]
    },
    {
        "id": "msg_008",
        "role": "user",
        "parts": [
            {
                "text": "Add reporting and analytics for HR",
                "type": "text"
            }
        ],
    },
    {
        "id": "msg_009",
        "role": "assistant",
        "parts": [
            {
                "type": "step-start"
            },
            {
                "type": "reasoning",
                "text": "HR needs comprehensive reporting for compliance and workforce planning. I'll add charts and export functionality.",
                "state": "done"
            },
            {
                "type": "tool-createOrEditFiles",
                "toolCallId": "toolu_01HRReports",
                "state": "output-available",
                "input": {
                    "path": "src/components/HRReports.tsx",
                    "description": "Analytics dashboard with charts and export features"
                },
                "output": {
                    "success": true,
                    "path": "src/components/HRReports.tsx",
                    "action": "created",
                    "description": "Analytics dashboard with charts and export features"
                }
            },
            {
                "type": "text",
                "text": "HR Analytics complete!\n\n**Advanced Features:**\n- Comprehensive vacation reports\n- Usage analytics and trends\n- Department comparisons\n- Export capabilities\n\n"
            }
        ]
    }
];
