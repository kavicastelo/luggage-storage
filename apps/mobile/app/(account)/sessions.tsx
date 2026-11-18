import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { SessionInfo } from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MobileIcon,
  ScreenContainer
} from "../../src/components";
import { authApi } from "../../src/services/auth-api";
import { useAuthStore } from "../../src/store/useAuthStore";
import { mobileColors, mobileRadius, mobileSpacing, mobileTextColors, mobileTypography } from "../../src/lib/theme";

export default function MobileSessionsScreen() {
  const router = useRouter();
  const { logoutAll } = useAuthStore();

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<SessionInfo | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getSessions();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load active sessions.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions(false);
  }, [loadSessions]);

  const handleRevokeSession = async () => {
    if (!revokeTarget) return;
    setIsSubmitting(true);
    try {
      await authApi.revokeSession(revokeTarget.id);
      if (revokeTarget.isCurrentSession) {
        router.replace("/");
        return;
      }
      setRevokeTarget(null);
      await loadSessions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke session.");
      setRevokeTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsSubmitting(true);
    try {
      await logoutAll();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke all sessions.");
    } finally {
      setIsSubmitting(false);
      setConfirmLogoutAll(false);
    }
  };

  return (
    <ScreenContainer
      refreshing={isRefreshing}
      onRefresh={() => loadSessions(true)}
      testID="account-sessions-screen"
    >
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Active Devices & Sessions</Text>
        <Text style={styles.subtitle}>
          Inspect every signed-in device session and revoke access individually or everywhere.
        </Text>
      </View>

      {error ? <ErrorState message={error} onRetry={() => loadSessions(false)} /> : null}

      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : sessions.length === 0 ? (
        <EmptyState
          mascot="sleeping"
          title="No Active Sessions"
          description="There are currently no active device sessions on this account."
        />
      ) : (
        <View style={styles.list}>
          {sessions.map((session) => (
            <Card key={session.id} variant="elevated" style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <View style={styles.iconCircle}>
                  <MobileIcon
                    name={session.clientType === "MOBILE" ? "smartphone" : "laptop"}
                    size="md"
                    color={mobileColors.navy[900]}
                  />
                </View>

                <View style={styles.sessionInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.sessionType}>
                      {session.clientType === "MOBILE" ? "Mobile App" : "Web Browser"}
                    </Text>
                    {session.isCurrentSession ? (
                      <Badge label="This Device" variant="success" size="sm" />
                    ) : null}
                  </View>
                  <Text style={styles.metaText} numberOfLines={2}>
                    {session.userAgent ?? "Device session"}
                  </Text>
                  <Text style={styles.metaText}>
                    IP: {session.ipAddress ?? "Recorded privately"} · Last active{" "}
                    {new Date(session.lastActiveAt).toLocaleString()}
                  </Text>
                </View>
              </View>

              <Button
                title={session.isCurrentSession ? "Revoke Current Session" : "Revoke Device"}
                variant={session.isCurrentSession ? "danger" : "outline"}
                size="sm"
                onPress={() => setRevokeTarget(session)}
                fullWidth
              />
            </Card>
          ))}
        </View>
      )}

      {sessions.length > 0 ? (
        <Button
          title="Sign Out From All Devices"
          variant="danger"
          leftIcon={<MobileIcon name="log-out" size="sm" color={mobileColors.white} />}
          onPress={() => setConfirmLogoutAll(true)}
          fullWidth
          style={styles.logoutAllBtn}
        />
      ) : null}

      <ConfirmDialog
        visible={Boolean(revokeTarget)}
        title="Revoke Session"
        description={
          revokeTarget?.isCurrentSession
            ? "Revoking your current session will immediately sign you out on this device."
            : "Terminate this remote device session?"
        }
        confirmLabel="Revoke"
        destructive
        icon="shield"
        isLoading={isSubmitting}
        onConfirm={handleRevokeSession}
        onCancel={() => setRevokeTarget(null)}
      />

      <ConfirmDialog
        visible={confirmLogoutAll}
        title="Sign Out Everywhere"
        description="This immediately invalidates all refresh sessions across every phone and browser."
        confirmLabel="Sign Out All"
        destructive
        icon="log-out"
        isLoading={isSubmitting}
        onConfirm={handleLogoutAll}
        onCancel={() => setConfirmLogoutAll(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: mobileSpacing[4],
    gap: mobileSpacing[1]
  },
  title: {
    ...mobileTypography.headingLg
  },
  subtitle: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.muted
  },
  list: {
    gap: mobileSpacing[3],
    marginBottom: mobileSpacing[5]
  },
  sessionCard: {
    gap: mobileSpacing[3]
  },
  sessionRow: {
    flexDirection: "row",
    gap: mobileSpacing[3],
    alignItems: "flex-start"
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.sand[100],
    alignItems: "center",
    justifyContent: "center"
  },
  sessionInfo: {
    flex: 1,
    gap: 2
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    flexWrap: "wrap"
  },
  sessionType: {
    ...mobileTypography.headingSm
  },
  metaText: {
    ...mobileTypography.bodySm
  },
  logoutAllBtn: {
    marginBottom: mobileSpacing[6]
  }
});
