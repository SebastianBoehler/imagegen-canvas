export type CanvasRenderable = {
  id: string;
  prompt: string;
  model: string;
  imageUrl: string | null;
  status: "pending" | "complete" | "error";
  error: string | null;
  position: { x: number; y: number };
};
