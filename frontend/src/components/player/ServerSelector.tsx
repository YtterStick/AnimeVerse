import { Captions, Mic } from "lucide-react";
import type { StreamServer } from "@/types";

interface ServerSelectorProps {
  servers: StreamServer[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

// Group servers by category
function groupByCategory(servers: StreamServer[]) {
  const groups: Record<string, { server: StreamServer; index: number }[]> = {};
  servers.forEach((server, index) => {
    const cat = server.category || "SUB";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ server, index });
  });
  return groups;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Captions; label: string }> = {
  SUB: { icon: Captions, label: "Subbed Server" },
  DUB: { icon: Mic, label: "Dubbed Server" },
  RAW: { icon: Captions, label: "Raw Server" },
};

export function ServerSelector({ servers, activeIndex, onSelect }: ServerSelectorProps) {
  if (servers.length === 0) return null;

  const groups = groupByCategory(servers);

  return (
    <div className="server-selector">
      {Object.entries(groups).map(([category, entries]) => {
        const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.SUB;
        const Icon = config.icon;

        return (
          <div key={category} className="server-category">
            <div className="server-category-label">
              <Icon className="server-category-icon" />
              <span>{config.label}</span>
            </div>

            <div className="server-buttons">
              {entries.map(({ server, index }) => (
                <button
                  key={index}
                  onClick={() => onSelect(index)}
                  className={`server-btn ${index === activeIndex ? "server-btn-active" : ""}`}
                >
                  <span className="server-btn-dot" />
                  {server.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ServerSelector;
