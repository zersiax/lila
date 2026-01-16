import { h, type VNode } from 'snabbdom';
import { bind } from 'lib/view';
import type { LearnNvuiContext } from '../learn.nvui';
import { renderBoard, renderSan, renderPieces } from 'lib/nvui/chess';
import { byId as stageById } from '../stage/list';
import { boardCommandsHandler, selectionHandler, arrowKeyHandler, pieceJumpingHandler, positionJumpHandler } from 'lib/nvui/handler';

export function renderNvui(ctx: LearnNvuiContext): VNode {
  const ctrl = ctx.ctrl;
  const inStage = ctrl.inStage();
  
  if (!inStage) {
    return renderMapNvui(ctx);
  }
  
  return renderStageNvui(ctx);
}

function renderMapNvui(ctx: LearnNvuiContext): VNode {
  const ctrl = ctx.ctrl;
  const stages = Object.entries(stageById).map(([id, stage]) => {
    const stageId = parseInt(id);
    const complete = ctrl.isStageIdComplete(stageId);
    const progress = ctrl.stageProgress(stage);
    const status = complete ? 'completed' : progress[0] > 0 ? 'in progress' : 'not started';
    
    return h('div.stage', [
      h('h3', `${stage.title} - ${status}`),
      h('p', stage.subtitle),
      h('p', `Progress: ${progress[0]} of ${progress[1]} levels completed`),
      h('a', { 
        attrs: { 
          href: `#${stageId}`,
          'aria-label': `Go to ${stage.title}`
        } 
      }, 'Enter stage'),
    ]);
  });

  return h('div.nvui', [
    h('h1', 'Learn Chess - Stage Selection'),
    h('div.nvui-stages', stages),
    h('div.instructions', [
      h('h2', 'Navigation'),
      h('p', 'Use Tab to navigate between stages, Enter to select a stage'),
    ]),
  ]);
}

function renderStageNvui(ctx: LearnNvuiContext): VNode {
  const ctrl = ctx.ctrl;
  const runCtrl = ctrl.runCtrl;
  const levelCtrl = runCtrl.levelCtrl;
  const stage = runCtrl.stage;
  
  if (!levelCtrl) {
    return h('div.nvui', 'Loading...');
  }

  const cg = runCtrl.chessground;
  const pieces = cg?.state.pieces;
  const turnColor = cg?.state.turnColor || 'white';
  const lastMove = cg?.state.lastMove;
  
  const goalText = levelCtrl.blueprint.goal;
  const levelNum = ctrl.opts.levelId || 1;
  const totalLevels = stage.levels.length;
  
  const boardSection = pieces ? h('div.board-section', [
    h('h2', 'Chess Board'),
    h('div.boardstatus', { attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } }),
    h('form#move-form', { 
      on: { 
        submit: (e: Event) => {
          e.preventDefault();
          const input = (e.target as HTMLFormElement).querySelector('input.move') as HTMLInputElement;
          const move = input.value;
          if (move && cg) {
            // Attempt to make the move
            const from = move.substring(0, 2) as SquareKey;
            const to = move.substring(2, 4) as SquareKey;
            const promotion = move[4];
            
            if (cg.state.movable.dests?.get(from)?.includes(to)) {
              cg.move(from, to);
              if (promotion) {
                cg.promote(to, promotion as cg.Role);
              }
              ctx.notify.set(`Moved from ${from} to ${to}`);
              input.value = '';
            } else {
              ctx.notify.set('Invalid move');
              input.value = '';
            }
          }
        }
      }
    }, [
      h('label', { attrs: { for: 'move-input' } }, 'Enter move:'),
      h('input.move#move-input', { 
        attrs: { 
          type: 'text',
          placeholder: 'e.g., e2e4',
          autocomplete: 'off'
        } 
      }),
    ]),
    renderBoard(
      pieces,
      turnColor,
      ctx.pieceStyle(),
      ctx.prefixStyle(),
      ctx.positionStyle(),
      ctx.boardStyle()
    ),
    h('div.board-info', [
      h('p', `Turn: ${turnColor}`),
      lastMove ? h('p.lastMove', `Last move: ${lastMove.join(' to ')}`) : null,
    ]),
  ]) : h('div.board-section', 'Board loading...');

  const handlers = pieces && cg ? {
    hook: {
      insert: (vnode: VNode) => {
        const el = vnode.elm as HTMLElement;
        const squares = el.querySelectorAll('.board-wrapper button');
        
        if (squares.length > 0) {
          squares.forEach(square => {
            square.addEventListener('keydown', arrowKeyHandler(turnColor, () => {}));
            square.addEventListener('keypress', pieceJumpingHandler(() => {}, () => {}));
            square.addEventListener('keydown', positionJumpHandler());
            square.addEventListener('keypress', boardCommandsHandler());
            square.addEventListener('click', selectionHandler(() => turnColor === 'white' ? 'black' : 'white'));
          });
          
          // Add keyboard shortcuts for level control
          document.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
              handleRestart();
            } else if (e.key === 'n' || e.key === 'N') {
              if (levelCtrl.vm.completed) handleNext();
            } else if (e.key === 'b' || e.key === 'B') {
              handleBack();
            }
          });
          
          (squares[0] as HTMLElement)?.focus();
        }
      }
    }
  } : {};

  const handleRestart = () => {
    runCtrl.restart();
    ctx.notify.set('Level restarted');
  };

  const handleNext = () => {
    if (levelCtrl.vm.completed) {
      levelCtrl.nextLevel();
      ctx.notify.set('Moving to next level');
    }
  };

  const handleBack = () => {
    window.location.hash = '';
    ctx.notify.set('Returning to stage selection');
  };

  return h('div.nvui', handlers, [
    h('h1', `${stage.title} - Level ${levelNum} of ${totalLevels}`),
    h('div.goal', [
      h('h2', 'Goal'),
      h('p', goalText),
    ]),
    levelCtrl.vm.completed && h('div.completed', [
      h('h2', 'Level Completed!'),
      h('p', `Score: ${levelCtrl.vm.score}`),
    ]),
    levelCtrl.vm.failed && h('div.failed', [
      h('h2', 'Try Again'),
      h('p', 'That move doesn\'t achieve the goal. Press R to restart.'),
    ]),
    boardSection,
    pieces && h('div.pieces-list', [
      h('h2', 'Pieces on Board'),
      renderPieces(pieces, ctx.moveStyle()),
    ]),
    h('div.controls', [
      h('h2', 'Controls'),
      h('button', { on: { click: handleRestart } }, 'Restart (R)'),
      levelCtrl.vm.completed && h('button', { on: { click: handleNext } }, 'Next Level (N)'),
      h('button', { on: { click: handleBack } }, 'Back to Stages (B)'),
    ]),
    h('div.instructions', [
      h('h2', 'Keyboard Commands'),
      h('ul', [
        h('li', 'Arrow keys: Navigate board squares'),
        h('li', 'Letters (p,n,b,r,q,k): Jump to piece'),
        h('li', 'O: Announce current square'),
        h('li', 'L: Announce last move'),
        h('li', 'M: Show possible moves from square'),
        h('li', 'Enter/Space: Select or move piece'),
        h('li', 'R: Restart level'),
        h('li', 'N: Next level (when completed)'),
        h('li', 'B: Back to stage selection'),
      ]),
    ]),
    h('div.notifications', {
      attrs: {
        'aria-live': 'assertive',
        'aria-atomic': 'true',
      }
    }, ctx.notify.get()),
  ]);
}