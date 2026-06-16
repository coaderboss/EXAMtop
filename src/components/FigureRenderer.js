// src/components/FigureRenderer.js
import SmilesViewer from './SmilesViewer';

export default function FigureRenderer({ figureType, figureData }) {
    if (!figureType || figureType === 'none' || !figureData) return null;

    return (
        <div style={{ marginBottom: '1.5rem', marginTop: '1rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
            
            {/* 1 & 2: Base64 or URL Images */}
            {(figureType === 'image' || figureType === 'url') && (
                <img 
                    src={figureData} 
                    alt="Question Diagram" 
                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)', objectFit: 'contain' }} 
                    onError={(e) => { e.target.style.display = 'none'; }} 
                />
            )}

            {/* 3: Chemistry SMILES Engine */}
            {figureType === 'smiles' && (
                <div style={{ display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: '8px' }}>
                    <SmilesViewer smilesCode={figureData} width={280} height={280} />
                </div>
            )}

            {/* 4: Math TikZ Engine */}
            {figureType === 'tikz' && (
                <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', maxWidth: '100%' }}>
                    <img 
                        src={`https://i.upmath.me/svg/${encodeURIComponent('\\begin{tikzpicture}\n' + figureData + '\n\\end{tikzpicture}')}`} 
                        alt="Math Graphic" 
                        style={{ maxWidth: '100%', objectFit: 'contain' }} 
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                </div>
            )}
        </div>
    );
}