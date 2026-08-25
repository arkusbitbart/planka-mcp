/**
 * Label operations for PLANKA API.
 */
import { plankaClient } from "../client.js";
import { Label, CardLabel } from "../schemas/entities.js";
import {
  CreateLabelSchema,
  UpdateLabelSchema,
  AddLabelToCardSchema,
  CreateLabelInput,
  UpdateLabelInput,
  AddLabelToCardInput,
} from "../schemas/requests.js";
import { LabelResponse, CardLabelResponse } from "../schemas/responses.js";
import { PlankaError } from "../errors.js";
import { getCard } from "./cards.js";

/**
 * Create a new label on a board.
 */
export async function createLabel(input: CreateLabelInput): Promise<Label> {
  const validated = CreateLabelSchema.parse(input);

  const response = await plankaClient.post<unknown>(
    `/api/boards/${validated.boardId}/labels`,
    {
      name: validated.name,
      color: validated.color,
      position: validated.position,
    }
  );

  const parsed = LabelResponse.parse(response);
  return parsed.item;
}

/**
 * Update a label's properties.
 */
export async function updateLabel(
  labelId: string,
  input: UpdateLabelInput
): Promise<Label> {
  const validated = UpdateLabelSchema.parse(input);

  const response = await plankaClient.patch<unknown>(
    `/api/labels/${labelId}`,
    validated
  );

  const parsed = LabelResponse.parse(response);
  return parsed.item;
}

/**
 * Delete a label.
 */
export async function deleteLabel(labelId: string): Promise<void> {
  await plankaClient.delete(`/api/labels/${labelId}`);
}

/**
 * Add a label to a card.
 * Uses PLANKA 2.0 /card-labels endpoint.
 */
export async function addLabelToCard(input: AddLabelToCardInput): Promise<CardLabel> {
  const validated = AddLabelToCardSchema.parse(input);

  const response = await plankaClient.post<unknown>(
    `/api/cards/${validated.cardId}/card-labels`,
    {
      labelId: validated.labelId,
    }
  );

  const parsed = CardLabelResponse.parse(response);
  return parsed.item;
}

/**
 * Remove a label from a card.
 * DELETE /cards/{cardId}/card-labels/labelId:{labelId}
 * (PLANKA uses the literal "labelId:" prefix in the path, so no lookup of
 * the junction record ID is needed.)
 *
 * A 404 is ambiguous: the label may already be gone, or the instance may
 * not support this path syntax. We verify against the card's current
 * labels instead of assuming success — a silent failure would be worse
 * than an honest error.
 */
export async function removeLabelFromCard(
  cardId: string,
  labelId: string
): Promise<void> {
  const path = `/api/cards/${cardId}/card-labels/labelId:${labelId}`;
  try {
    await plankaClient.delete(path);
  } catch (error) {
    if (error instanceof PlankaError && error.status === 404) {
      const details = await getCard(cardId);
      const stillOnCard = details.cardLabels.some(
        (cl) => cl.labelId === labelId
      );
      if (!stillOnCard) {
        // Label is not on the card (anymore) — removal is a no-op
        return;
      }
      throw new PlankaError(
        `Removing label ${labelId} from card ${cardId} could not be confirmed: ` +
          `DELETE ${path} returned 404, but the label is still on the card. ` +
          "This PLANKA instance may not support the labelId: path syntax.",
        "REMOVE_LABEL_UNCONFIRMED",
        404
      );
    }
    throw error;
  }
}

/**
 * Set labels on a card (add some, remove others).
 */
export async function setCardLabels(
  cardId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[]
): Promise<void> {
  // Remove labels first
  if (removeLabelIds && removeLabelIds.length > 0) {
    for (const labelId of removeLabelIds) {
      await removeLabelFromCard(cardId, labelId);
    }
  }

  // Add labels
  if (addLabelIds && addLabelIds.length > 0) {
    for (const labelId of addLabelIds) {
      try {
        await addLabelToCard({ cardId, labelId });
      } catch (error) {
        // Ignore if label already on card
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("already")) {
          throw error;
        }
      }
    }
  }
}
