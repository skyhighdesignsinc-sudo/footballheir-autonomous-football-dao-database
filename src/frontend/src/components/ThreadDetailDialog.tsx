import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Pin, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Thread } from "../backend";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useAddPost } from "../hooks/useQueries";

interface ThreadDetailDialogProps {
  thread: Thread;
  open: boolean;
  onClose: () => void;
}

export function ThreadDetailDialog({
  thread,
  open,
  onClose,
}: ThreadDetailDialogProps) {
  const { identity } = useInternetIdentity();
  const addPost = useAddPost();
  const [replyContent, setReplyContent] = useState("");

  const isAuthenticated = !!identity;
  const activePosts = thread.posts.filter((p) => !p.isDeleted);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!replyContent.trim()) {
      toast.error("Please enter a reply");
      return;
    }

    try {
      await addPost.mutateAsync({
        threadId: thread.id,
        content: replyContent.trim(),
      });
      toast.success("Reply posted successfully!");
      setReplyContent("");
    } catch (error: any) {
      toast.error(error.message || "Failed to post reply");
    }
  };

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) / 1_000_000).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{thread.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-4 text-sm mt-2">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {thread.author.toString().slice(0, 12)}...
            </span>
            <span>{formatDate(thread.createdAt)}</span>
            <Badge variant="secondary">{activePosts.length} posts</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {activePosts.map((post, index) => (
            <div key={Number(post.id)}>
              {index > 0 && <Separator className="mb-6" />}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-mono text-sm">
                        {post.author.toString().slice(0, 16)}...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(post.createdAt)}
                      </div>
                    </div>
                  </div>
                  {post.isPinned && (
                    <Badge
                      variant="default"
                      className="flex items-center gap-1"
                    >
                      <Pin className="h-3 w-3" />
                      Pinned
                    </Badge>
                  )}
                </div>
                <div className="pl-13">
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                </div>
              </div>
            </div>
          ))}

          {isAuthenticated && (
            <>
              <Separator />
              <form onSubmit={handleReply} className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Write your reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button type="submit" disabled={addPost.isPending}>
                  {addPost.isPending ? "Posting..." : "Post Reply"}
                </Button>
              </form>
            </>
          )}

          {!isAuthenticated && (
            <div className="text-center py-6 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Log in with at least 1 ICFC token to reply to this thread
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
