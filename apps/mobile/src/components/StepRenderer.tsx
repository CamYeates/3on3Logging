import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FlowContext, FlowOption, FlowStep } from '../flow/types';
import { OptionGrid } from './OptionGrid';
import { PlayerGrid } from './PlayerGrid';
import { colors, font, spacing } from '../theme';

interface StepRendererProps {
  step: FlowStep;
  context: FlowContext;
  teamColors: Record<string, string>;
  /** Teams in the game, used to inject options for team-scoped steps (timeout). */
  teams: { id: string; name: string }[];
  onSelect: (value: string | number | null) => void;
}

/**
 * Renders a single flow step generically. The action definitions describe what
 * to ask; this component only knows how to draw players vs. options. One
 * decision per screen — nothing else is shown.
 */
export function StepRenderer({
  step,
  context,
  teamColors,
  teams,
  onSelect,
}: StepRendererProps) {
  const renderBody = () => {
    if (step.kind === 'player' || step.kind === 'player-optional') {
      const filterTeam = step.teamFilter?.(context) ?? null;
      const players = context.players.filter(
        (p) => !filterTeam || p.teamId === filterTeam,
      );
      return (
        <PlayerGrid
          players={players}
          teamColors={teamColors}
          onSelect={(playerId) => onSelect(playerId)}
          noneLabel={step.kind === 'player-optional' ? step.noneLabel : undefined}
          onNone={step.kind === 'player-optional' ? () => onSelect(null) : undefined}
        />
      );
    }

    // option step
    let options: FlowOption[] = step.options?.(context) ?? [];
    // Inject team options for team-scoped steps (e.g. Timeout).
    if (options.length === 0 && step.id === 'team') {
      options = teams.map((t) => ({
        label: t.name,
        value: t.id,
        color: teamColors[t.id],
      }));
    }
    return <OptionGrid options={options} onSelect={(v) => onSelect(v)} />;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{step.title}</Text>
      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  title: { color: colors.text, fontSize: font.title, fontWeight: '700' },
});
