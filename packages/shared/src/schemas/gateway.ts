import { z } from 'zod';

export const gatewayPreviewSchema = z.object({
  input: z.string(),
  mapped: z.string(),
  warnings: z.array(z.string()).default([]),
});

export const gatewaySendResultSchema = z.object({
  messageId: z.string(),
  accepted: z.boolean(),
  recipients: z.array(z.string()),
  warnings: z.array(z.string()).default([]),
});

export const inboundGatewayMessageSchema = z.object({
  uid: z.string(),
  subject: z.string(),
  from: z.string(),
  receivedAt: z.string().datetime(),
});

export type GatewayPreview = z.infer<typeof gatewayPreviewSchema>;
export type GatewaySendResult = z.infer<typeof gatewaySendResultSchema>;
export type InboundGatewayMessage = z.infer<typeof inboundGatewayMessageSchema>;
