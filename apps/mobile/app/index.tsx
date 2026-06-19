import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameStatus, type Game } from '@3on3/shared';
import { BigButton } from '../src/components/BigButton';
import { SyncStatusBadge } from '../src/components/SyncStatusBadge';
import { listGames } from '../src/db/gamesRepo';
import { countPendingSync } from '../src/db/syncQueueRepo';
import { pullGamesFromCloud, syncPendingEvents } from '../src/sync/syncService';
import { colors, font, radius, spacing } from '../src/theme';

/** Home: list of local games, create-new, resume, and a sync indicator. */
export default function HomeScreen() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const [g, p] = await Promise.all([listGames(), countPendingSync()]);
    setGames(g);
    setPending(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSync = async () => {
    setSyncing(true);
    try {
      await pullGamesFromCloud();
      await syncPendingEvents();
    } finally {
      setSyncing(false);
      await load();
    }
  };

  const resumeRoute = (game: Game) =>
    game.status === GameStatus.SETUP
      ? `/game/${game.id}/roster`
      : `/game/${game.id}/log`;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <SyncStatusBadge pending={pending} syncing={syncing} />
        <View style={styles.headerButtons}>
          <BigButton label="Sync Now" small color={colors.surfaceAlt} onPress={onSync} style={styles.headerBtn} />
          <BigButton
            label="+ New Game"
            small
            color={colors.primary}
            onPress={() => router.push('/create-game')}
            style={styles.headerBtn}
          />
        </View>
      </View>

      <FlatList
        data={games}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No games yet. Tap “+ New Game” to start.</Text>
        }
        renderItem={({ item }) => (
          <Link href={resumeRoute(item)} asChild>
            <Pressable style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {item.teamAName} vs {item.teamBName}
                </Text>
                <Text style={styles.cardMeta}>
                  {new Date(item.gameDate).toLocaleString()} ·{' '}
                  {item.scoringMode === 'three_x_three' ? '3x3' : 'Standard'}
                </Text>
              </View>
              <View style={[styles.statusPill, statusColor(item.status)]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}

function statusColor(status: Game['status']) {
  switch (status) {
    case GameStatus.ACTIVE:
      return { backgroundColor: colors.success };
    case GameStatus.COMPLETED:
      return { backgroundColor: colors.primary };
    case GameStatus.SETUP:
      return { backgroundColor: colors.warning };
    default:
      return { backgroundColor: colors.surfaceAlt };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  headerButtons: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: { flex: 0, minWidth: 140 },
  list: { padding: spacing.md, gap: spacing.md },
  empty: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: font.large, fontWeight: '700' },
  cardSub: { color: colors.text, fontSize: font.body, marginTop: 2 },
  cardMeta: { color: colors.textMuted, fontSize: font.small, marginTop: 4 },
  statusPill: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: { color: colors.primaryText, fontWeight: '700', textTransform: 'capitalize' },
});
