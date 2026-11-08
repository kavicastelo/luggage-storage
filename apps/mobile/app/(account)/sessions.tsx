import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";
import { SessionInfo } from "@luggage-storage/contracts";
import { authApi } from "../../src/services/auth-api";

export default function MobileSessionsScreen() {
  const router = useRouter();
  const { sessionId: currentSessionId, logout, logoutAll } = useAuthStore();

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getSessions();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load active sessions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    setActionLoading(sessionId);
    setError(null);
    try {
      await authApi.revokeSession(sessionId);
      if (sessionId === currentSessionId) {
        await logout();
        router.replace("/");
        return;
      }
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoutAll = () => {
    Alert.alert(
      "Sign Out All Devices",
      "Are you sure you want to revoke all active sessions across all devices? You will be signed out immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out All",
          style: "destructive",
          onPress: async () => {
            setActionLoading("all");
            try {
              await logoutAll();
              router.replace("/");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to sign out from all sessions");
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Active Sessions</Text>
          <Text style={styles.subtitle}>Devices with active logins</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutAllButton}
          onPress={handleLogoutAll}
          disabled={actionLoading !== null || isLoading}
        >
          {actionLoading === "all" ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <Text style={styles.logoutAllText}>Sign Out All</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Fetching active sessions...</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          refreshing={isLoading}
          onRefresh={fetchSessions}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const isCurrent = item.id === currentSessionId || item.isCurrentSession;
            return (
              <View style={styles.sessionCard}>
                <View style={styles.sessionInfo}>
                  <View style={styles.deviceRow}>
                    <Text style={styles.deviceType}>
                      {item.clientType === "MOBILE" ? "📱 Mobile Device" : "💻 Web Browser"}
                    </Text>
                    {isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>This Device</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.sessionMeta}>
                    IP: {item.ipAddress || "Unknown"}
                  </Text>
                  <Text style={styles.sessionMeta} numberOfLines={1}>
                    Agent: {item.userAgent || "Unknown client"}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    Last Active: {new Date(item.lastActiveAt).toLocaleString()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.revokeButton,
                    isCurrent ? styles.revokeCurrentButton : null
                  ]}
                  onPress={() => handleRevokeSession(item.id)}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Text style={styles.revokeButtonText}>
                      {isCurrent ? "Sign Out" : "Revoke"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  listContainer: {
    padding: 16
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2
  },
  logoutAllButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  logoutAllText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700"
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 8
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10
  },
  errorBannerText: {
    color: "#b91c1c",
    fontSize: 13
  },
  sessionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  deviceType: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a"
  },
  currentBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  currentBadgeText: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "700"
  },
  sessionMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2
  },
  revokeButton: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff5f5"
  },
  revokeCurrentButton: {
    borderColor: "#f87171"
  },
  revokeButtonText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600"
  }
});

