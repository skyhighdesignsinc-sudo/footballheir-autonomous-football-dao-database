import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  MessageSquare,
  MoreVertical,
  Pin,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Post, Thread } from "../backend";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAddPost,
  useAllThreads,
  useCallerICFCBalance,
  useCreateThread,
  useIsAdmin,
} from "../hooks/useQueries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(timestamp: bigint): string {
  const ms = Number(timestamp) / 1_000_000;
  const diff = Date.now() - ms;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncatePrincipal(p: { toString(): string }): string {
  const s = p.toString();
  return s.length > 16 ? `${s.slice(0, 16)}…` : s;
}

function principalInitial(p: { toString(): string }): string {
  return p.toString().charAt(0).toUpperCase();
}

function escapeText(s: string): string {
  return s;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ThreadListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading threads">
      {(["sk1", "sk2", "sk3", "sk4"] as const).map((id) => (
        <Card key={id} className="border-border">
          <CardContent className="py-4 px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function PrincipalAvatar({ principal }: { principal: { toString(): string } }) {
  return (
    <div
      aria-hidden="true"
      className="h-9 w-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-display font-semibold text-sm select-none shrink-0"
    >
      {principalInitial(principal)}
    </div>
  );
}

// ─── New Thread Modal ─────────────────────────────────────────────────────────

interface NewThreadModalProps {
  open: boolean;
  onClose: () => void;
}

function NewThreadModal({ open, onClose }: NewThreadModalProps) {
  const createThread = useCreateThread();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Thread title is required.");
      return;
    }
    if (!content.trim()) {
      toast.error("Post content is required.");
      return;
    }
    try {
      await createThread.mutateAsync({
        title: title.trim(),
        content: content.trim(),
      });
      toast.success("Thread created successfully!");
      setTitle("");
      setContent("");
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create thread.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto bg-card border-border mx-0 sm:mx-auto rounded-none sm:rounded-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            New Discussion Thread
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              data-ocid="forum-new-thread-title"
              placeholder="What's this thread about?"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-background border-input"
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/120
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thread-content">Opening Post</Label>
            <Textarea
              id="thread-content"
              data-ocid="forum-new-thread-content"
              placeholder="Share your thoughts, evidence, or proposal discussion..."
              maxLength={2000}
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="bg-background border-input resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/2000
            </p>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded px-3 py-2">
            Thread ID will be tied to a proposal via on-chain governance. All
            posts are public and immutable on the Internet Computer.
          </p>

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              data-ocid="forum-new-thread-submit"
              disabled={createThread.isPending}
            >
              {createThread.isPending ? "Posting…" : "Create Thread"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Post Item ────────────────────────────────────────────────────────────────

interface PostItemProps {
  post: Post;
  threadId: number;
  isAdmin: boolean;
  onModerated: () => void;
}

function PostItem({ post, threadId, isAdmin, onModerated }: PostItemProps) {
  const { actor } = useActor();
  const [moderating, setModerating] = useState(false);

  const handlePin = async () => {
    if (!actor) return;
    setModerating(true);
    try {
      await actor.pinPost(threadId, post.id);
      toast.success(post.isPinned ? "Post unpinned." : "Post pinned.");
      onModerated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Moderation failed.");
    } finally {
      setModerating(false);
    }
  };

  const handleDelete = async () => {
    if (!actor) return;
    setModerating(true);
    try {
      await actor.deletePost(threadId, post.id);
      toast.success("Post removed by DAO moderation.");
      onModerated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setModerating(false);
    }
  };

  if (post.isDeleted) {
    return (
      <li className="py-4 px-1 text-sm text-muted-foreground italic border-l-2 border-border/40 pl-4">
        [This post was removed by the DAO]
      </li>
    );
  }

  return (
    <li className="py-4 group">
      <div className="flex gap-3 min-w-0">
        <PrincipalAvatar principal={post.author} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
            <span
              className="font-mono text-xs text-foreground/80 truncate"
              title={post.author.toString()}
            >
              {truncatePrincipal(post.author)}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {relativeTime(post.createdAt)}
            </span>
            {post.isPinned && (
              <Badge
                variant="outline"
                className="text-gold border-gold/50 bg-gold/10 gap-1 px-1.5 py-0 text-[10px] shrink-0"
              >
                <Pin className="h-2.5 w-2.5" aria-hidden="true" />
                Pinned
              </Badge>
            )}
          </div>

          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {escapeText(post.content)}
          </p>

          {isAdmin && (
            <div className="mt-3">
              {/* Desktop: inline buttons, hidden by default, shown on hover */}
              <div className="hidden sm:flex gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-gold hover:text-gold hover:bg-gold/10"
                  onClick={handlePin}
                  disabled={moderating}
                  aria-label={post.isPinned ? "Unpin post" : "Pin post"}
                  data-ocid={`forum-post-pin-${post.id}`}
                >
                  <Pin className="h-3 w-3 mr-1" aria-hidden="true" />
                  {post.isPinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                  disabled={moderating}
                  aria-label="Delete post (DAO moderation)"
                  data-ocid={`forum-post-delete-${post.id}`}
                >
                  <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
                  Remove
                </Button>
              </div>
              {/* Mobile: collapsed dropdown */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground"
                      aria-label="Post moderation actions"
                      data-ocid={`forum-post-actions-${post.id}`}
                      disabled={moderating}
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={handlePin}
                      className="text-gold focus:text-gold focus:bg-gold/10 gap-2"
                    >
                      <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                      {post.isPinned ? "Unpin post" : "Pin post"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Thread Detail View ───────────────────────────────────────────────────────

interface ThreadDetailProps {
  thread: Thread;
  isAdmin: boolean;
  icfcBalance: bigint;
  onBack: () => void;
}

function ThreadDetail({
  thread,
  isAdmin,
  icfcBalance,
  onBack,
}: ThreadDetailProps) {
  const { identity } = useInternetIdentity();
  const addPost = useAddPost();
  const [reply, setReply] = useState("");
  // force re-render after moderation by using a key counter
  const [refreshKey, setRefreshKey] = useState(0);

  const isAuthenticated = !!identity;
  const canPost = isAuthenticated && icfcBalance >= 1n;
  const totalVisible = thread.posts.length;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) {
      toast.error("Reply cannot be empty.");
      return;
    }
    try {
      await addPost.mutateAsync({ threadId: thread.id, content: reply.trim() });
      toast.success("Reply posted!");
      setReply("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post reply.");
    }
  };

  return (
    <section aria-label={`Thread: ${thread.title}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="Back to thread list"
          data-ocid="forum-thread-back"
          className="shrink-0 mt-0.5"
        >
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-2xl font-semibold leading-tight break-words">
            {thread.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="font-mono">
              {truncatePrincipal(thread.author)}
            </span>
            <span>·</span>
            <span>{relativeTime(thread.createdAt)}</span>
            <span>·</span>
            <span>
              {totalVisible} {totalVisible === 1 ? "post" : "posts"}
            </span>
          </p>
        </div>
      </div>

      {/* Posts */}
      <Card className="border-border bg-card mb-6">
        <CardContent className="px-5 py-0">
          {thread.posts.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground text-sm">
              No posts yet. Be the first to reply.
            </p>
          ) : (
            <ul className="divide-y divide-border/50" key={refreshKey}>
              {thread.posts.map((post) => (
                <PostItem
                  key={`${post.id}-${post.isDeleted}-${post.isPinned}`}
                  post={post}
                  threadId={thread.id}
                  isAdmin={isAdmin}
                  onModerated={() => setRefreshKey((k) => k + 1)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Reply form */}
      <Card className="border-border bg-card" data-ocid="forum-reply-section">
        <CardContent className="px-5 py-5">
          {!isAuthenticated ? (
            <div className="text-center py-4">
              <ShieldAlert
                className="h-8 w-8 text-muted-foreground mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                Connect your Internet Identity to post replies.
              </p>
            </div>
          ) : !canPost ? (
            <div className="text-center py-4 bg-muted/30 rounded border border-border">
              <p className="text-sm text-muted-foreground">
                You need ≥1 ICFC to post in discussions.
              </p>
            </div>
          ) : (
            <form onSubmit={handleReply} className="space-y-3">
              <Label htmlFor="reply-content" className="font-medium text-sm">
                Your Reply
              </Label>
              <Textarea
                id="reply-content"
                data-ocid="forum-reply-textarea"
                placeholder="Share your thoughts…"
                maxLength={2000}
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="bg-background border-input resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {reply.length}/2000
                </span>
                <Button
                  type="submit"
                  data-ocid="forum-reply-submit"
                  disabled={addPost.isPending || !reply.trim()}
                  aria-label="Submit reply"
                >
                  {addPost.isPending ? "Posting…" : "Post Reply"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ─── Thread Card ──────────────────────────────────────────────────────────────

interface ThreadCardProps {
  thread: Thread;
  onClick: () => void;
}

function ThreadCard({ thread, onClick }: ThreadCardProps) {
  const postCount = thread.posts.filter((p) => !p.isDeleted).length;
  const hasPinned = thread.posts.some((p) => p.isPinned && !p.isDeleted);
  const firstPost = thread.posts.find((p) => !p.isDeleted);

  return (
    <li>
      <Card
        className="border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer group"
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        tabIndex={0}
        aria-label={`Thread: ${thread.title}`}
        data-ocid={`forum-thread-card-${thread.id}`}
      >
        <CardContent className="px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <PrincipalAvatar principal={thread.author} />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h3 className="font-display font-semibold text-base leading-snug text-foreground group-hover:text-primary transition-colors truncate max-w-xs sm:max-w-md">
                  {thread.title.length > 80
                    ? `${thread.title.slice(0, 80)}…`
                    : thread.title}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasPinned && (
                    <Badge
                      variant="outline"
                      className="text-gold border-gold/50 bg-gold/10 gap-1 px-1.5 text-[10px]"
                      aria-label="Has pinned posts"
                    >
                      <Pin className="h-2.5 w-2.5" aria-hidden="true" />
                      Pinned
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className="gap-1 px-2 text-xs"
                    aria-label={`${postCount} posts`}
                  >
                    <MessageSquare className="h-3 w-3" aria-hidden="true" />
                    {postCount}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap mt-1">
                <span
                  className="font-mono text-xs text-muted-foreground truncate"
                  title={thread.author.toString()}
                >
                  {truncatePrincipal(thread.author)}
                </span>
                <span className="text-muted-foreground/50 text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(thread.createdAt)}
                </span>
              </div>

              {firstPost && (
                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-snug">
                  {firstPost.content}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

// ─── Filter Tab ───────────────────────────────────────────────────────────────

type FilterTab = "all" | "my" | "pinned";

interface FilterTabsProps {
  active: FilterTab;
  onSelect: (tab: FilterTab) => void;
}

function FilterTabs({ active, onSelect }: FilterTabsProps) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "my", label: "My Threads" },
    { id: "pinned", label: "Pinned" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter threads"
      className="flex gap-1 bg-muted/40 border border-border rounded-md p-1 w-fit"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          data-ocid={`forum-filter-${tab.id}`}
          onClick={() => onSelect(tab.id)}
          className={`px-4 py-1.5 text-sm font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            active === tab.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── ForumPage ────────────────────────────────────────────────────────────────

export function ForumPage() {
  const { identity } = useInternetIdentity();
  const { data: threads = [], isLoading, refetch } = useAllThreads();
  const { data: icfcBalance = 0n } = useCallerICFCBalance();
  const { data: isAdmin = false } = useIsAdmin();
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [newThreadOpen, setNewThreadOpen] = useState(false);

  const isAuthenticated = !!identity;
  const canPost = isAuthenticated && icfcBalance >= 1n;

  // Filtered thread list (skip deleted threads)
  const visibleThreads = threads
    .filter((t) => !t.isDeleted)
    .filter((t) => {
      if (filter === "my") {
        return (
          isAuthenticated &&
          t.author.toString() === identity?.getPrincipal().toString()
        );
      }
      if (filter === "pinned") {
        return t.posts.some((p) => p.isPinned && !p.isDeleted);
      }
      return true;
    })
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  // If we have an active thread, sync it with fresh data from query
  const liveThread = activeThread
    ? (threads.find((t) => t.id === activeThread.id) ?? activeThread)
    : null;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-3xl">
      {/* Breadcrumb / detail back */}
      {liveThread ? (
        <ThreadDetail
          thread={liveThread}
          isAdmin={isAdmin}
          icfcBalance={icfcBalance}
          onBack={() => {
            setActiveThread(null);
            refetch();
          }}
        />
      ) : (
        <>
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Community Forum
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                DAO discussions — holder-only posting, all content on-chain
              </p>
            </div>

            {canPost ? (
              <Button
                onClick={() => setNewThreadOpen(true)}
                aria-label="Create a new discussion thread"
                data-ocid="forum-new-thread-btn"
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                New Thread
              </Button>
            ) : isAuthenticated ? (
              <Badge
                variant="outline"
                className="border-destructive/50 text-destructive bg-destructive/10 text-xs px-3 py-1.5"
              >
                ≥1 ICFC required to post
              </Badge>
            ) : null}
          </div>

          {/* Read-only notice for unauthenticated */}
          {!isAuthenticated && (
            <Card className="mb-5 border-primary/30 bg-primary/5">
              <CardContent className="py-3 px-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Read-only mode.</strong>{" "}
                  Connect your Internet Identity and hold ≥1 ICFC to post.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Filter tabs */}
          <div className="mb-5">
            <FilterTabs active={filter} onSelect={setFilter} />
          </div>

          <Separator className="mb-6 bg-border/50" />

          {/* Thread list */}
          {isLoading ? (
            <ThreadListSkeleton />
          ) : visibleThreads.length === 0 ? (
            <div
              className="text-center py-20 space-y-3"
              data-ocid="forum-empty-state"
              aria-label="No threads found"
            >
              <MessageSquare
                className="h-12 w-12 text-muted-foreground mx-auto"
                aria-hidden="true"
              />
              <p className="text-muted-foreground font-medium">
                {filter === "my"
                  ? "You haven't started any threads yet."
                  : filter === "pinned"
                    ? "No pinned discussions found."
                    : "No discussions yet. Start the first conversation about Football God."}
              </p>
              {canPost && filter === "all" && (
                <Button
                  variant="outline"
                  onClick={() => setNewThreadOpen(true)}
                  data-ocid="forum-empty-cta"
                >
                  Start the First Discussion
                </Button>
              )}
            </div>
          ) : (
            <ul aria-label="Discussion threads" className="space-y-3">
              {visibleThreads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  onClick={() => setActiveThread(thread)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {/* New Thread Modal */}
      <NewThreadModal
        open={newThreadOpen}
        onClose={() => setNewThreadOpen(false)}
      />
    </div>
  );
}
