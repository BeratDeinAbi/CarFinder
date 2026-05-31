interface Props {
  score: number;
}

export default function ScoreBadge({ score }: Props) {
  const cls = score >= 70 ? 'good' : score >= 45 ? 'mid' : 'bad';
  return <div className={`score-badge ${cls}`}>{score}</div>;
}
