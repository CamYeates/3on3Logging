import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  calculateTeamStats,
  getRecentEvents,
  type GamePlayer,
} from '@3on3/shared';
import { BigButton } from '../../../src/components/BigButton';
import { RecentEvents } from '../../../src/components/RecentEvents';
import { ScoreBar } from '../../../src/components/ScoreBar';
import { StepRenderer } from '../../../src/components/StepRenderer';
import { ACTION_DEFINITIONS } from '../../../src/flow/actionDefinitions';
import type { FlowContext } from '../../../src/flow/types';
import { getDeviceId } from '../../../src/lib/device';
import { useGameStore } from '../../../src/store/gameStore';
import { colors, font, spacing } from '../../../src/theme';

/**
 * The main logging screen. Two modes:
 *  - Idle: a grid of large action buttons + recent events + utilities.
 *  - In-flow: the current step rendered generically with Back/Cancel.
 *
 * Principle: show only what the current step needs.
 */
export default function LogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    game,
    players,
    events,
    playerTeamMap,
    activeAction,
    currentStep,
    selections,
    pendingSync,
    syncing,
    loadGame,
    startAction,
    selectValue,
    back,
    undoLast,
    runSync,
  } = useGameStore();

  useEffect(() => {
    if (id) void loadGame(id);
  }, [id, loadGame]);

  const teamStats = useMemo(
    () => calculateTeamStats(events, playerTeamMap),
    [events, playerTeamMap],
  );

  const recent = useMemo(() => getRecentEvents(events, 5), [events]);

  if (!game) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const teamColors: Record<string, string> = {
    [game.teamAId]: colors.teamA,
    [game.teamBId]: colors.teamB,
  };
  const teams = [
    { id: game.teamAId, name: game.teamAName },
    { id: game.teamBId, name: game.teamBName },
  ];

  const flowContext: FlowContext = {
    gameId: game.id,
    scoringMode: game.scoringMode,
    deviceId: getDeviceId(),
    players: players.filter((p: GamePlayer) => p.active),
    selections,
  };

  const step = currentStep();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScoreBar
        game={game}
        scoreA={teamStats[game.teamAId]?.points ?? 0}
        scoreB={teamStats[game.teamBId]?.points ?? 0}
        pendingSync={pendingSync}
        syncing={syncing}
      />

      <View style={styles.body}>
        {/* Main work area */}
        <View style={styles.main}>
          {activeAction && step ? (
            <View style={styles.flowWrap}>
              <View style={styles.flowHeader}>
                <Pressable onPress={back} style={styles.backBtn}>
                  <Text style={styles.backText}>‹ Back</Text>
                </Pressable>
                <Text style={styles.flowAction}>{activeAction.label}</Text>
              </View>
              <ScrollView contentContainerStyle={styles.flowScroll}>
                <StepRenderer
                  step={step}
                  context={flowContext}
                  teamColors={teamColors}
                  teams={teams}
                  onSelect={(v) => void selectValue(v)}
                />
              </ScrollView>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.actionGrid}>
              {ACTION_DEFINITIONS.map((def) => (
                <View key={def.actionType} style={styles.actionCell}>
                  <BigButton
                    label={def.label}
                    color={def.color}
                    onPress={() => startAction(def.actionType)}
                    testID={`action-${def.actionType}`}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Side panel: recent events + utilities */}
        <View style={styles.side}>
          <RecentEvents events={recent} players={players} />
          <View style={styles.utilities}>
            <BigButton label="Undo Last" small color={colors.danger} onPress={() => void undoLast()} />
            <BigButton label="Sync Now" small color={colors.surfaceAlt} onPress={() => void runSync()} loading={syncing} />
            <BigButton
              label="Game Summary"
              small
              color={colors.primary}
              onPress={() => router.push(`/game/${game.id}/summary`)}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { color: colors.textMuted, fontSize: font.large, padding: spacing.xl },
  body: { flex: 1, flexDirection: 'row' },
  main: { flex: 2, padding: spacing.lg },
  side: { flex: 1, padding: spacing.lg, gap: spacing.md, maxWidth: 380 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCell: { width: '31%', minWidth: 160, height: 96 },
  flowWrap: { flex: 1, gap: spacing.lg },
  flowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  backBtn: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  backText: { color: colors.primary, fontSize: font.large, fontWeight: '700' },
  flowAction: { color: colors.textMuted, fontSize: font.large, fontWeight: '700' },
  flowScroll: { paddingBottom: spacing.xl },
  utilities: { gap: spacing.md },
});
