import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../src/db/database';
import { colors, font } from '../src/theme';

/**
 * Root layout. Initializes the local SQLite database before rendering routes so
 * every screen can assume the DB exists.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to open database</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: '3on3 Logging' }} />
        <Stack.Screen name="create-game" options={{ title: 'New Game' }} />
        <Stack.Screen name="game/[id]/roster" options={{ title: 'Roster' }} />
        <Stack.Screen
          name="game/[id]/log"
          options={{ title: 'Logging', headerShown: false }}
        />
        <Stack.Screen name="game/[id]/summary" options={{ title: 'Summary' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: 8,
  },
  error: { color: colors.danger, fontSize: font.large, fontWeight: '700' },
  errorDetail: { color: colors.textMuted, fontSize: font.body },
});
