/**
 * Attachment tools for PLANKA MCP server.
 */
import { addAttachment, getUploadDir } from "../operations/attachments.js";
import { PlankaError } from "../errors.js";

/**
 * The attachment tool is only registered when PLANKA_UPLOAD_DIR is set.
 */
export function isAttachmentToolEnabled(): boolean {
  return getUploadDir() !== null;
}

/**
 * Tool: planka_add_attachment
 * Upload a file from PLANKA_UPLOAD_DIR as an attachment on a card.
 */
export const addAttachmentTool = {
  name: "planka_add_attachment",
  description:
    "Upload a file as an attachment on a card. filePath is resolved relative to the configured PLANKA_UPLOAD_DIR; files outside that directory are rejected.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      cardId: {
        type: "string",
        description: "The card ID to attach the file to",
      },
      filePath: {
        type: "string",
        description:
          "Path to the file, relative to PLANKA_UPLOAD_DIR (absolute paths must also point inside it)",
      },
      name: {
        type: "string",
        description:
          "Optional display name for the attachment (default: the file name)",
      },
    },
    required: ["cardId", "filePath"],
  },
  handler: async (params: {
    cardId: string;
    filePath: string;
    name?: string;
  }) => {
    try {
      const attachment = await addAttachment({
        cardId: params.cardId,
        filePath: params.filePath,
        name: params.name,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                attachment: {
                  id: attachment.id,
                  cardId: attachment.cardId,
                  name: attachment.name,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof PlankaError) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
      throw error;
    }
  },
};

export const attachmentTools = [addAttachmentTool];
