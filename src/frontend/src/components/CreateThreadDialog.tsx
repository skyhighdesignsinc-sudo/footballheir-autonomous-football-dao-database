import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateThread } from "../hooks/useQueries";

interface CreateThreadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateThreadDialog({ open, onClose }: CreateThreadDialogProps) {
  const createThread = useCreateThread();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please provide a thread title");
      return;
    }

    if (!content.trim()) {
      toast.error("Please provide thread content");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to create thread");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Thread</DialogTitle>
          <DialogDescription>
            Start a new discussion in the community forum
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Thread Title</Label>
            <Input
              id="title"
              placeholder="Enter a descriptive title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Initial Post</Label>
            <Textarea
              id="content"
              placeholder="Start the discussion..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={createThread.isPending}
              className="flex-1"
            >
              {createThread.isPending ? "Creating..." : "Create Thread"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
