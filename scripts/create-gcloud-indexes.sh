#!/usr/bin/env bash
set -e

echo "Creating index 1/55 for audit_logs..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=audit_logs \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 2/55 for audit_logs..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=audit_logs \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=deviceId,order=ascending \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 3/55 for security_events..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=security_events \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=occurredAt,order=descending

echo "Creating index 4/55 for security_events..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=security_events \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=isBlocked,order=ascending \
    --field-config=field-path=occurredAt,order=descending

echo "Creating index 5/55 for devices..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=devices \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=lastSeenAt,order=descending

echo "Creating index 6/55 for devices..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=devices \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=status,order=ascending

echo "Creating index 7/55 for device_locations..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=device_locations \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=deviceId,order=ascending \
    --field-config=field-path=recordedAt,order=descending

echo "Creating index 8/55 for web_checks..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=web_checks \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=checkedAt,order=descending

echo "Creating index 9/55 for web_checks..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=web_checks \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=verdict,order=ascending \
    --field-config=field-path=checkedAt,order=descending

echo "Creating index 10/55 for app_permission_scans..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=app_permission_scans \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=scannedAt,order=descending

echo "Creating index 11/55 for app_permissions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=app_permissions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=isDangerous,order=descending

echo "Creating index 12/55 for installed_apps..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=installed_apps \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=riskScore,order=descending

echo "Creating index 13/55 for installed_apps..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=installed_apps \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=scanId,order=ascending

echo "Creating index 14/55 for wifi_networks..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=wifi_networks \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=lastDetectedAt,order=descending

echo "Creating index 15/55 for wifi_networks..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=wifi_networks \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=deviceId,order=ascending \
    --field-config=field-path=networkHash,order=ascending

echo "Creating index 16/55 for vpn_sessions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=vpn_sessions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 17/55 for vpn_sessions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=vpn_sessions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=connectionStatus,order=ascending

echo "Creating index 18/55 for theft_commands..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=theft_commands \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=deviceId,order=ascending \
    --field-config=field-path=issuedAt,order=descending

echo "Creating index 19/55 for theft_commands..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=theft_commands \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=issuedAt,order=descending

echo "Creating index 20/55 for companion_sessions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=companion_sessions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=companionId,order=ascending \
    --field-config=field-path=loginTime,order=descending

echo "Creating index 21/55 for companion_sessions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=companion_sessions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=companionId,order=ascending \
    --field-config=field-path=loginTime,order=descending

echo "Creating index 22/55 for companion_accounts..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=companion_accounts \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=email,order=ascending

echo "Creating index 23/55 for notifications..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=notifications \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 24/55 for notifications..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=notifications \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=isRead,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 25/55 for user_keys..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=user_keys \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=keyCreatedAt,order=descending

echo "Creating index 26/55 for threats..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=threats \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=isActive,order=ascending \
    --field-config=field-path=severity,order=ascending \
    --field-config=field-path=lastSeenAt,order=descending

echo "Creating index 27/55 for threats..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=threats \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=isActive,order=ascending \
    --field-config=field-path=threatType,order=ascending \
    --field-config=field-path=lastSeenAt,order=descending

echo "Creating index 28/55 for refresh_tokens..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=refresh_tokens \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=revoked,order=ascending

echo "Creating index 29/55 for mobileDevices..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileDevices \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=lastSeen,order=descending

echo "Creating index 30/55 for mobileDevices..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileDevices \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=isActive,order=ascending \
    --field-config=field-path=lastSeen,order=descending

echo "Creating index 31/55 for mobileDevices..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileDevices \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=deviceIdHash,order=ascending

echo "Creating index 32/55 for mobileAntiThefts..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAntiThefts \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 33/55 for mobileAntiThefts..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAntiThefts \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=status,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 34/55 for mobileAntiThefts..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAntiThefts \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=deviceId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 35/55 for mobilePhishingDetections..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobilePhishingDetections \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 36/55 for mobilePhishingDetections..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobilePhishingDetections \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=status,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 37/55 for mobilePhishingDetections..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobilePhishingDetections \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=riskScore,order=descending

echo "Creating index 38/55 for mobileVpnConnections..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileVpnConnections \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=connectedAt,order=descending

echo "Creating index 39/55 for mobileVpnConnections..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileVpnConnections \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=connectionStatus,order=ascending \
    --field-config=field-path=connectedAt,order=descending

echo "Creating index 40/55 for mobileAppPermissions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAppPermissions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=appName,order=ascending

echo "Creating index 41/55 for mobileAppPermissions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAppPermissions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=status,order=ascending \
    --field-config=field-path=appName,order=ascending

echo "Creating index 42/55 for mobileAppPermissions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAppPermissions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=appName,order=ascending \
    --field-config=field-path=permissionType,order=ascending

echo "Creating index 43/55 for mobileSecurityLogs..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileSecurityLogs \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=timestamp,order=descending

echo "Creating index 44/55 for mobileSecurityLogs..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileSecurityLogs \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=severity,order=ascending \
    --field-config=field-path=timestamp,order=descending

echo "Creating index 45/55 for mobileSecurityLogs..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileSecurityLogs \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=status,order=ascending \
    --field-config=field-path=timestamp,order=descending

echo "Creating index 46/55 for mobileSecurityLogs..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileSecurityLogs \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=eventType,order=ascending \
    --field-config=field-path=timestamp,order=descending

echo "Creating index 47/55 for mobileSecurityLogs..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileSecurityLogs \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=status,order=ascending \
    --field-config=field-path=severity,order=ascending

echo "Creating index 48/55 for mobileAppSessions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAppSessions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=loginTime,order=descending

echo "Creating index 49/55 for mobileAppSessions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAppSessions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=status,order=ascending \
    --field-config=field-path=loginTime,order=descending

echo "Creating index 50/55 for mobileAppSessions..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAppSessions \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=deviceId,order=ascending \
    --field-config=field-path=loginTime,order=descending

echo "Creating index 51/55 for mobileAuditEvents..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAuditEvents \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=adminId,order=ascending \
    --field-config=field-path=timestamp,order=descending

echo "Creating index 52/55 for mobileAuditEvents..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAuditEvents \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=userId,order=ascending \
    --field-config=field-path=timestamp,order=descending

echo "Creating index 53/55 for mobileAuditEvents..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAuditEvents \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=action,order=ascending \
    --field-config=field-path=timestamp,order=descending

echo "Creating index 54/55 for mobileUsers..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileUsers \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=adminId,order=ascending \
    --field-config=field-path=createdAt,order=descending

echo "Creating index 55/55 for mobileAdmins..."
gcloud firestore indexes composite create \
    --project=shield-419e1 \
    --database="(default)" \
    --collection-group=mobileAdmins \
    --query-scope=collection \
    --density=dense \
    --api-scope=mongodb-compatible-api \
    --field-config=field-path=createdAt,order=descending
