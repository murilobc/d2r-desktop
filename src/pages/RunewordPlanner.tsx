import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, RuneCount, RunewordTarget } from "../types";
import { getRuneInventory, updateRuneCount, getRunewordTargets, addRunewordTarget, removeRunewordTarget } from "../api";
import type { RuneInventory } from "../lib/eligibility-engine";
import { RUNEWORD_RECIPES } from "../data/runewords";
import RuneGrid from "../components/RuneGrid";
import EligibilityList from "../components/EligibilityList";
import ProgressView from "../components/ProgressView";
import CubeCalculator from "../components/CubeCalculator";

interface Props {
  readonly profile: Profile;
}

function RunewordPlanner({ profile }: Props) {
  const { t } = useTranslation();
  const [inventory, setInventory] = useState<RuneInventory>({});
  const [targets, setTargets] = useState<RunewordTarget[]>([]);
  const [cubeTarget, setCubeTarget] = useState<string | null>(null);

  const loadInventory = async () => {
    try {
      const counts: RuneCount[] = await getRuneInventory(profile.id);
      const inv: RuneInventory = {};
      for (const rc of counts) {
        inv[rc.rune_name] = rc.count;
      }
      setInventory(inv);
    } catch (err) {
      console.error("Failed to load rune inventory:", err);
    }
  };

  const loadTargets = async () => {
    try {
      const t = await getRunewordTargets(profile.id);
      setTargets(t);
    } catch (err) {
      console.error("Failed to load runeword targets:", err);
    }
  };

  useEffect(() => {
    loadInventory();
    loadTargets();
  }, [profile.id]);

  const handleIncrement = async (runeName: string) => {
    try {
      await updateRuneCount(profile.id, runeName, 1);
      await loadInventory();
    } catch (err) {
      console.error("Failed to increment rune:", err);
    }
  };

  const handleDecrement = async (runeName: string) => {
    try {
      await updateRuneCount(profile.id, runeName, -1);
      await loadInventory();
    } catch (err) {
      console.error("Failed to decrement rune:", err);
    }
  };

  const handleAddTarget = async (runewordName: string) => {
    try {
      await addRunewordTarget(profile.id, runewordName);
      await loadTargets();
    } catch (err) {
      console.error("Failed to add runeword target:", err);
    }
  };

  const handleRemoveTarget = async (id: string) => {
    try {
      await removeRunewordTarget(id);
      await loadTargets();
    } catch (err) {
      console.error("Failed to remove runeword target:", err);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('runewordPlanner.title', 'Runeword Planner')}</h1>
      </div>
      <div className="runeword-planner-grid">
        <section>
          <RuneGrid
            inventory={inventory}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
          />
        </section>
        <section>
          <EligibilityList
            inventory={inventory}
            recipes={RUNEWORD_RECIPES}
          />
        </section>
        <section>
          <ProgressView
            inventory={inventory}
            targets={targets}
            recipes={RUNEWORD_RECIPES}
            onAddTarget={handleAddTarget}
            onRemoveTarget={handleRemoveTarget}
          />
        </section>
        <section>
          <CubeCalculator
            inventory={inventory}
            targetRune={cubeTarget}
            onSelectRune={setCubeTarget}
          />
        </section>
      </div>
    </div>
  );
}

export default RunewordPlanner;
