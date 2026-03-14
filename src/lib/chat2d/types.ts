import type { ImageMetadata, Persona } from "$lib/types";
import type { Message } from "$lib/stores/messages";

export interface Chat2DParseContext {
    persona: Persona | null;
    userName: string;
}

export type Chat2DBlock =
    | { type: "user"; id: string; content: string }
    | { type: "user-interaction"; id: string; content: string }
    | { type: "narration"; id: string; content: string }
    | { type: "dialogue"; id: string; speaker: string; content: string }
    | {
          type: "image";
          id: string;
          url: string;
          alt: string;
          metadata: ImageMetadata;
          index: number;
      }
    | { type: "markdown_image"; id: string; url: string; alt: string }
    | { type: "code"; id: string; language: string; content: string }
    | {
          type: "input_prompt";
          id: string;
          prompt_type: string;
          question: string;
          variable: string;
          max: number | null;
      }
    | { type: "astro_chart"; id: string; input: Record<string, unknown> }
    | { type: "vars_status"; id: string; variables: Record<string, string> }
    | { type: "situation_trigger"; id: string };

export interface StreamAssemblyResult {
    content: string;
    hasPendingStyle: boolean;
}

export interface Chat2DViewportState {
    sourceMessages: Message[];
    visibleMessages: Message[];
    blocks: Chat2DBlock[];
    isTyping: boolean;
    hasPendingInteractiveRender: boolean;
}
