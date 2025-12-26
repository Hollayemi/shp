"use client";

import { useState } from "react";
import {
  User,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ConvexUserViewerProps {
  projectId: string;
}

export function ConvexUserViewer({ projectId }: ConvexUserViewerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
  });

  const { data, isLoading, error } = useQuery({
    ...trpc.projects.getConvexUsers.queryOptions({
      projectId,
      limit: 50,
    }),
    enabled: !!projectId,
  });

  const createUserMutation = useMutation(
    trpc.projects.createConvexUser.mutationOptions({
      onSuccess: () => {
        toast.success("User created successfully");
        setIsAddDialogOpen(false);
        setNewUser({ email: "", name: "", password: "" });
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getConvexUsers.queryKey({ projectId, limit: 50 }),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create user");
      },
    })
  );

  const deleteUserMutation = useMutation(
    trpc.projects.deleteConvexUser.mutationOptions({
      onSuccess: () => {
        toast.success("User deleted successfully");
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getConvexUsers.queryKey({ projectId, limit: 50 }),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete user");
      },
    })
  );

  const users = data?.users ?? [];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCreateUser = () => {
    if (!newUser.email || !newUser.password) {
      toast.error("Email and password are required");
      return;
    }
    if (newUser.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    createUserMutation.mutate({
      projectId,
      email: newUser.email,
      name: newUser.name || undefined,
      password: newUser.password,
    });
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate({
      projectId,
      userId,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, idx) => (
          <div
            key={idx}
            className="flex items-center gap-4 rounded-xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <XCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
          Failed to load users
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with user count and add button */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
            Registered Users
          </h3>
          <Badge
            variant="outline"
            className="border-[#1E9A80] bg-[#ECFDF5] text-[#1E9A80] dark:border-[#1E9A80] dark:bg-[#1A2421] dark:text-[#1E9A80]"
          >
            {users.length} {users.length === 1 ? "user" : "users"}
          </Badge>
        </div>

        {/* Add User Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with email and password authentication.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {users.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <User className="h-12 w-12 text-[#8A9A94]" />
          <div className="text-center">
            <h3 className="mb-1 text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
              No Users Yet
            </h3>
            <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
              Users will appear here once they sign up, or you can add them
              manually.
            </p>
          </div>
        </div>
      )}

      {/* User list */}
      {users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user._id}
              className="group flex items-center gap-4 rounded-xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]"
            >
              {/* Avatar */}
              <Avatar className="h-10 w-10">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name ?? "User"} />
                ) : null}
                <AvatarFallback className="bg-[#1E9A80] text-white">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>

              {/* User info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate font-medium text-[#141414] dark:text-[#F5F9F7]">
                    {user.name || "Unnamed User"}
                  </h4>
                  {user.emailVerified ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-[#1E9A80]" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-[#8A9A94]" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-[#727272] dark:text-[#8A9A94]">
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {user.email}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(user._creationTime)}
                  </span>
                </div>
              </div>

              {/* Delete button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    disabled={deleteUserMutation.isPending}
                  >
                    {deleteUserMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete{" "}
                      <span className="font-medium">
                        {user.name || user.email}
                      </span>
                      ? This action cannot be undone and will remove all their
                      authentication data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteUser(user._id)}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
