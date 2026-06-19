import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScoringMode, createGameSchema } from '@3on3/shared';
import { BigButton } from '../src/components/BigButton';
import { createGame } from '../src/db/gamesRepo';
import { colors, font, radius, spacing } from '../src/theme';

/** Create Game form. One screen, minimal fields. */
export default function CreateGameScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [scoringMode, setScoringMode] = useState<ScoringMode>(ScoringMode.STANDARD);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onCreate = async () => {
    setError(null);
    const parsed = createGameSchema.safeParse({
      name,
      location: location || null,
      gameDate: new Date().toISOString(),
      teamAName,
      teamBName,
      scoringMode,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setSaving(true);
    try {
      const game = await createGame(parsed.data);
      router.replace(`/game/${game.id}/roster`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="Game name">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Friday Night Run"
          placeholderTextColor={colors.textMuted}
        />
      </Field>

      <Field label="Location (optional)">
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Court 3"
          placeholderTextColor={colors.textMuted}
        />
      </Field>

      <View style={styles.row}>
        <Field label="Team A" style={styles.half}>
          <TextInput
            style={[styles.input, { borderColor: colors.teamA }]}
            value={teamAName}
            onChangeText={setTeamAName}
            placeholder="Red Hawks"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        <Field label="Team B" style={styles.half}>
          <TextInput
            style={[styles.input, { borderColor: colors.teamB }]}
            value={teamBName}
            onChangeText={setTeamBName}
            placeholder="Blue Wolves"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
      </View>

      <Field label="Scoring mode">
        <View style={styles.row}>
          <BigButton
            label="Standard (2 / 3 / FT)"
            color={scoringMode === ScoringMode.STANDARD ? colors.primary : colors.surfaceAlt}
            onPress={() => setScoringMode(ScoringMode.STANDARD)}
          />
          <BigButton
            label="3x3 (1 / 2 / FT)"
            color={scoringMode === ScoringMode.THREE_X_THREE ? colors.primary : colors.surfaceAlt}
            onPress={() => setScoringMode(ScoringMode.THREE_X_THREE)}
          />
        </View>
      </Field>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BigButton label="Create Game" color={colors.success} onPress={onCreate} loading={saving} />
    </ScrollView>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, maxWidth: 900, width: '100%', alignSelf: 'center' },
  field: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: font.body, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.large,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  error: { color: colors.danger, fontSize: font.body },
});
