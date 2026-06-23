interface Props {
  magicFind: number;
}

function calcEffective(mf: number, factor: number): number {
  return Math.round((mf * factor) / (mf + factor));
}

export default function MFCalculator({ magicFind }: Props) {
  const effectiveUnique = calcEffective(magicFind, 250);
  const effectiveSet = calcEffective(magicFind, 500);
  const effectiveRare = calcEffective(magicFind, 600);

  return (
    <div className="mf-calculator">
      <div className="mf-header">
        <span className="mf-label">MF: {magicFind}%</span>
        <span className="mf-sublabel">Effective MF</span>
      </div>
      <div className="mf-values">
        <div className="mf-item">
          <span className="mf-rarity" style={{ color: "var(--unique)" }}>Unique</span>
          <span className="mf-effective">{effectiveUnique}%</span>
        </div>
        <div className="mf-item">
          <span className="mf-rarity" style={{ color: "var(--set)" }}>Set</span>
          <span className="mf-effective">{effectiveSet}%</span>
        </div>
        <div className="mf-item">
          <span className="mf-rarity" style={{ color: "var(--rare)" }}>Rare</span>
          <span className="mf-effective">{effectiveRare}%</span>
        </div>
      </div>
    </div>
  );
}
