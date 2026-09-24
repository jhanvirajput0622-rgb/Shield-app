import mongoose from "mongoose";
import { SecurityEvent, ISecurityEvent } from "../models/SecurityEvent";

export class SecurityEventService {
  async getRecentEvents(
    userId: mongoose.Types.ObjectId,
    limit = 10
  ): Promise<ISecurityEvent[]> {
    return SecurityEvent.find({ userId })
      .sort({ occurredAt: -1 })
      .limit(limit) as unknown as Promise<ISecurityEvent[]>;
  }

  async getBlockedThreatsCount(userId: mongoose.Types.ObjectId): Promise<number> {
    return SecurityEvent.countDocuments({ userId, isBlocked: true });
  }

  async emit(
    userId: mongoose.Types.ObjectId,
    deviceId: mongoose.Types.ObjectId | null,
    eventType: string,
    severity: ISecurityEvent["severity"],
    title: string,
    description = "",
    isBlocked = false,
    metadata: Record<string, unknown> = {}
  ): Promise<ISecurityEvent> {
    return SecurityEvent.create({
      userId,
      deviceId,
      eventType,
      severity,
      title,
      description,
      isBlocked,
      metadata,
      occurredAt: new Date(),
    });
  }
}

export const securityEventService = new SecurityEventService();
