interface Props {
  characterId: number;
  characterName: string;
  size?: number;
  className?: string;
}

export function CharacterAvatar({ characterId, characterName, size = 32, className = "" }: Props) {
  return (
    <img
      src={`https://images.evetech.net/characters/${characterId}/portrait?size=${size}`}
      alt={characterName}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = `https://images.evetech.net/characters/0/portrait?size=${size}`;
      }}
    />
  );
}
