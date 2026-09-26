import { SecurityEvent, ISecurityEvent } from "../models/SecurityEvent";

export class SecurityEventService {
  async getRecentEvents(
    userId: string,
    limit = 10
  ): Promise<ISecurityEvent[]> {
    return SecurityEvent.find({ userId })
      .sort({ occurredAt: -1 })
      .limit(limit) as unknown as Promise<ISecurityEvent[]>;
  }

  async getBlockedThreatsCount(userId: string): Promise<number> {
    return SecurityEvent.countDocuments({ userId, isBlocked: true });
  }

  async emit(
    userId: string,
    deviceId: string | null,
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
