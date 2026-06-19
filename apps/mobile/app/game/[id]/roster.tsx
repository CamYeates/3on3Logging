import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  GameStatus,
  rosterSchema,
  type Game,
  type PlayerInput,
} from '@3on3/shared';
import { BigButton } from '../../../src/components/BigButton';
import { getGame, setRoster, updateGameStatus } from '../../../src/db/gamesRepo';
import { colors, font, radius, spacing } from '../../../src/theme';

type DraftPlayer = PlayerInput & { key: string };

let keyCounter = 0;
const blankPlayer = (): DraftPlayer => ({
  key: `p${keyCounter++}`,
  name: '',
  jerseyNumber: '',
  active: true,
});

/** Roster setup for both teams. Minimum 3 players per team to start. */
export default function RosterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [teamA, setTeamA] = useState<DraftPlayer[]>([blankPlayer(), blankPlayer(), blankPlayer()]);
  const [teamB, setTeamB] = useState<DraftPlayer[]>([blankPlayer(), blankPlayer(), blankPlayer()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) void getGame(id).then(setGame);
  }, [id]);

  const onStart = async () => {
    if (!game) return;
    setError(null);

    const cleanA = teamA.filter((p) => p.name.trim());
    const cleanB = teamB.filter((p) => p.name.trim());

    const a = rosterSchema.safeParse(cleanA);
    const b = rosterSchema.safeParse(cleanB);
    if (!a.success) return setError(`Team A: ${a.error.issues[0]?.message}`);
    if (!b.success) return setError(`Team B: ${b.error.issues[0]?.message}`);

    setSaving(true);
    try {
      await setRoster(game.id, game.teamAId, a.data);
      await setRoster(game.id, game.teamBId, b.data);
      await updateGameStatus(game.id, GameStatus.ACTIVE);
      router.replace(`/game/${game.id}/log`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start game');
      setSaving(false);
    }
  };

  if (!game) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.teams}>
        <TeamColumn
          title={game.teamAName}
          accent={colors.teamA}
          players={teamA}
          setPlayers={setTeamA}
        />
        <TeamColumn
          title={game.teamBName}
          accent={colors.teamB}
          players={teamB}
          setPlayers={setTeamB}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BigButton label="Start Game" color={colors.success} onPress={onStart} loading={saving} />
    </ScrollView>
  );
}

function TeamColumn({
  title,
  accent,
  players,
  setPlayers,
}: {
  title: string;
  accent: string;
  players: DraftPlayer[];
  setPlayers: React.Dispatch<React.SetStateAction<DraftPlayer[]>>;
}) {
  const update = (key: string, patch: Partial<DraftPlayer>) =>
    setPlayers((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const remove = (key: string) =>
    setPlayers((prev) => prev.filter((p) => p.key !== key));

  return (
    <View style={styles.column}>
      <Text style={[styles.teamTitle, { color: accent }]}>{title}</Text>
      {players.map((p) => (
        <View key={p.key} style={styles.playerRow}>
          <TextInput
            style={[styles.jersey]}
            value={p.jerseyNumber ?? ''}
            onChangeText={(t) => update(p.key, { jerseyNumber: t })}
            placeholder="#"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={3}
          />
          <TextInput
            style={styles.name}
            value={p.name}
            onChangeText={(t) => update(p.key, { name: t })}
            placeholder="Player name"
            placeholderTextColor={colors.textMuted}
          />
          <Switch
            value={p.active}
            onValueChange={(v) => update(p.key, { active: v })}
            trackColor={{ true: colors.success, false: colors.surfaceAlt }}
          />
          <Pressable onPress={() => remove(p.key)} style={styles.removeBtn}>
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={() => setPlayers((prev) => [...prev, blankPlayer()])}
        style={styles.addBtn}
      >
        <Text style={styles.addText}>+ Add player</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  teams: { flexDirection: 'row', gap: spacing.lg },
  column: { flex: 1, gap: spacing.sm },
  teamTitle: { fontSize: font.large, fontWeight: '800', marginBottom: spacing.sm },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  jersey: {
    width: 56,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: font.body,
    padding: spacing.sm,
    textAlign: 'center',
  },
  name: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: font.body,
    padding: spacing.sm,
  },
  removeBtn: { padding: spacing.sm },
  removeText: { color: colors.danger, fontSize: font.large, fontWeight: '700' },
  addBtn: { padding: spacing.md, alignItems: 'center' },
  addText: { color: colors.primary, fontSize: font.body, fontWeight: '700' },
  error: { color: colors.danger, fontSize: font.body },
});
