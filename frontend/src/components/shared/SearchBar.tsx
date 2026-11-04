import React, { useState } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  initialValue?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  initialValue = "",
  onSearch,
  placeholder = "Search for anime...",
  className = "",
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value.trim());
  };

  const handleClear = () => {
    setValue("");
    onSearch("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex items-center w-full max-w-xl ${className}`}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 bg-card hover:bg-secondary/40 focus:bg-card border border-border/80 rounded-full pl-11 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60 shadow-sm"
      />
      <Search className="absolute left-4 w-4 h-4 text-muted-foreground/80 pointer-events-none" />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-4 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </form>
  );
}

export default SearchBar;
