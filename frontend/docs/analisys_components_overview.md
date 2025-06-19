# Analysis Components Overview

## Components

### 1. **EngineStatusPanel** 
```typescript
// src/components/analysis/EngineStatusPanel/
```
**Purpose**: Displays status of both traditional and live analysis engines  
**Features**: 
- Real-time connection status indicators
- Error state handling with user-friendly messages
- Grid layout for multiple engine types
- Integration with Alert component for status messaging

**UI Library Usage**: Alert component for status messages

---

### 2. **BoardSection**
```typescript
// src/components/chess/BoardSection/
```
**Purpose**: Handles chess board display and navigation controls  
**Features**:
- Chess board rendering with move arrows and highlights
- Move navigation (previous, next, start, end)
- Board options (flip, show arrows, auto-analyze)
- Keyboard shortcut support
- Responsive design for mobile

**UI Library Usage**: Button components for all controls

---

### 3. **CurrentMoveInfo**
```typescript
// src/components/analysis/CurrentMoveInfo/
```
**Purpose**: Displays analysis information for the current move  
**Features**:
- Cached analysis from database (evaluation, best move, mistakes)
- Live analysis results with multiple lines
- Analysis indicators and loading states
- Professional formatting for chess notation
- Mistake severity visualization

**UI Library Usage**: LoadingSpinner for analyzing states

---

### 4. **LiveAnalysisControls**
```typescript
// src/components/analysis/LiveAnalysisControls/
```
**Purpose**: Controls for live analysis settings and execution  
**Features**:
- Interactive sliders for depth and time limit settings
- Connection status indicator with real-time updates
- Manual analysis trigger button
- Settings summary and descriptions
- Status messages for different states

**UI Library Usage**: Button for analysis triggers

---

### 5. **AnalysisSummary**
```typescript
// src/components/analysis/AnalysisSummary/
```
**Purpose**: Comprehensive overview of game analysis results  
**Features**:
- Statistics grid with icons and descriptions
- Player accuracy meters with grades (A+, B, etc.)
- Circular progress indicators for accuracy
- Smart insights based on analysis data
- Performance comparison between players
- Mistake categorization (blunders, mistakes, inaccuracies)

**UI Library Usage**: ProgressBar for accuracy and completion tracking

---

### 6. **MoveList**
```typescript
// src/components/chess/MoveList/
```
**Purpose**: Interactive list of game moves with analysis data  
**Features**:
- Move-by-move display with chess notation
- Analysis indicators (evaluation, mistakes, best moves)
- Color-coded move quality (excellent, good, mistake, blunder)
- Interactive move selection
- Analysis legend
- Compact mode support
- Custom scrollbar styling

**UI Library Usage**: None (pure display component)

---

### 7. **AnalysisActions**
```typescript
// src/components/analysis/AnalysisActions/
```
**Purpose**: Action buttons and tools for analysis management  
**Features**:
- Re-analyze and delete analysis functionality
- Variation explorer integration
- Export capabilities
- Confirmation modals for destructive actions
- Keyboard shortcut hints
- Action grouping (primary vs secondary)

**UI Library Usage**: Button, Modal, Alert components

---


## Integration Example

Here's how the refactored GameAnalysisPage would now look:

```typescript
// Simplified GameAnalysisPage structure
const GameAnalysisPage = () => {
  // State management (significantly reduced)
  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  // ... other essential state

  return (
    <div className="game-analysis-page">
      {/* Header with game info */}
      <PageHeader game={game} />
      
      {/* Engine Status */}
      <EngineStatusPanel 
        engineStatus={engineStatus}
        liveAnalysisState={liveAnalysisState}
      />
      
      {/* Main Analysis View */}
      <div className="analysis-layout">
        <div className="board-column">
          <BoardSection
            position={currentPosition}
            orientation={boardOrientation}
            currentMoveIndex={currentMoveIndex}
            totalMoves={gameData?.totalMoves || 0}
            onGoToMove={setCurrentMoveIndex}
            // ... other props
          />
          
          <CurrentMoveInfo
            currentMoveIndex={currentMoveIndex}
            moveNotation={currentMove?.san}
            cachedAnalysis={currentMoveAnalysis}
            liveAnalysisResult={liveAnalysisState.currentResult}
            isAnalyzing={liveAnalysisState.isAnalyzing}
          />
        </div>
        
        <div className="analysis-column">
          <LiveAnalysisControls
            settings={liveAnalysisSettings}
            isConnected={liveAnalysisState.isConnected}
            isAnalyzing={liveAnalysisState.isAnalyzing}
            onUpdateSettings={handleLiveAnalysisUpdate}
            onAnalyzeNow={handleAnalyzeNow}
          />
          
          {analysisResult && (
            <AnalysisSummary analysisResult={analysisResult} />
          )}
          
          <MoveList
            moves={gameData?.moves || []}
            analysisDetails={analysis?.analysisDetails}
            currentMoveIndex={currentMoveIndex}
            totalMoves={gameData?.totalMoves || 0}
            onMoveClick={setCurrentMoveIndex}
          />
          
          <AnalysisActions
            hasAnalysis={!!analysis}
            isAnalyzing={analyzing}
            onStartNewAnalysis={handleStartAnalysis}
            onDeleteAnalysis={handleDeleteAnalysis}
            onOpenVariationExplorer={() => setAnalysisMode('explorer')}
          />
        </div>
      </div>
    </div>
  );
};
```

---

## File Structure

```
src/
├── components/
│   ├── ui/                     # ✅ Established UI Library
│   │   ├── Button/
│   │   ├── Alert/
│   │   ├── LoadingSpinner/
│   │   ├── Modal/
│   │   └── ProgressBar/
│   ├── analysis/               # 🆕 Analysis Components
│   │   ├── EngineStatusPanel/
│   │   ├── CurrentMoveInfo/
│   │   ├── LiveAnalysisControls/
│   │   ├── AnalysisSummary/
│   │   └── AnalysisActions/
│   └── chess/                  # 🆕 Chess Components
│       ├── BoardSection/
│       └── MoveList/
└── pages/
    └── GameAnalysisPage.tsx   # 📉 Now ~200 lines vs 800+
```

