import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-8 px-4 md:px-8">
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400">
          Audiomancer
        </h1>
        <p className="text-bunker-300 mt-2 text-lg">
          Weaving sound with the magic of AI.
        </p>
      </div>
    </header>
  );
};

export default Header;
