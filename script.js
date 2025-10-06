let verses = [];
let mandalas = [];
let svg, g, zoom;
let currentVerseIndex = -1;
let initialTransform;

async function init() {
    try {
        if (typeof d3 === 'undefined') throw new Error('D3.js failed to load.');
        const response = await fetch('./rigveda_data_augmented.json');
        if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
        
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Data must be an array');

        verses = data.map((d, i) => ({...d, originalIndex: i}));
        
        const groupedByMandala = d3.group(verses, d => d.mandala);
        mandalas = Array.from(groupedByMandala, ([mandalaNum, versesInMandala]) => ({
            mandalaNum,
            verses: versesInMandala
        }));

        calculatePositions();
        initializeVisualization();
        setupEventListeners();

        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Initialization Error:', error);
        const errDiv = document.getElementById('error');
        const errMsg = document.getElementById('error-message');
        errMsg.textContent = `Error: ${error.message}. Please ensure the data file is present and you are running this on a server.`;
        errDiv.style.display = 'flex';
        document.getElementById('loading').style.display = 'none';
    }
}

function calculatePositions() {
    const numMandalas = mandalas.length;
    const mainRadius = 250; 
    const mandalaRadius = 60; 

    mandalas.forEach((mandala, i) => {
        const angle = (i / numMandalas) * 2 * Math.PI;
        mandala.x = mainRadius * Math.cos(angle);
        mandala.y = mainRadius * Math.sin(angle);
        
        const numVerses = mandala.verses.length;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        
        mandala.verses.forEach((verse, j) => {
            const r = Math.sqrt(j / numVerses) * mandalaRadius * 0.95;
            const theta = j * goldenAngle;
            verse.x = r * Math.cos(theta);
            verse.y = r * Math.sin(theta);
        });
    });
}

function initializeVisualization() {
    const container = document.getElementById('viz-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // This re-selects the SVG, which is important after a resize clear
    svg = d3.select('#network-svg').attr('width', width).attr('height', height);
    g = svg.append('g');
    
    g.append('circle')
        .attr('r', 150)
        .attr('fill', 'var(--gold)');
    
    g.append('text')
        .attr('class', 'om-symbol')
        .text('🕉️');

    const mandalaGroups = g.selectAll('.mandala-group')
        .data(mandalas)
        .join('g')
        .attr('class', 'mandala-group')
        .attr('transform', d => `translate(${d.x}, ${d.y})`);

    mandalaGroups.append('circle')
        .attr('class', 'mandala-circle')
        .attr('r', 60)
        .on('click', (event, d) => {
            event.stopPropagation();
            zoomToMandala(d);
        });

    mandalaGroups.each(function(mandalaData) {
        d3.select(this).selectAll('.verse-dot')
            .data(mandalaData.verses)
            .join('circle')
            .attr('class', 'verse-dot')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 0.75)
            .on('click', (event, d) => {
                event.stopPropagation();
                openVerseModal(d.originalIndex);
            });
    });

    const bounds = g.node().getBBox();
    const scale = Math.min(width / bounds.width, height / bounds.height) * 0.8;
    const translateX = width / 2 - (bounds.x + bounds.width / 2) * scale;
    const translateY = height / 2 - (bounds.y + bounds.height / 2) * scale;
    
    initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    zoom = d3.zoom()
        .scaleExtent([initialTransform.k, initialTransform.k * 50])
        .on('zoom', (event) => g.attr('transform', event.transform));
    
    svg.call(zoom).call(zoom.transform, initialTransform);
}

function zoomToMandala(mandalaData) {
    const width = svg.attr('width');
    const height = svg.attr('height');
    const scale = initialTransform.k * 3.5;

    const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-mandalaData.x, -mandalaData.y);
    
    svg.transition().duration(1000).call(zoom.transform, transform);
}
        
function zoomToVerse(verseIndex) {
    const verse = verses[verseIndex];
    const mandala = mandalas.find(m => m.mandalaNum === verse.mandala);
    if (!mandala) return;

    const width = svg.attr('width');
    const height = svg.attr('height');
    const scale = initialTransform.k * 30;

    const targetX = mandala.x + verse.x;
    const targetY = mandala.y + verse.y;
    
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-targetX, -targetY);
    
    svg.transition()
        .duration(2000)
        .call(zoom.transform, transform)
        .on('end', () => openVerseModal(verseIndex));
}

function openVerseModal(vIndex) {
    currentVerseIndex = vIndex;
    const verse = verses.find(v => v.originalIndex === vIndex);
    if (!verse) return;
    
    document.getElementById('modal-header').textContent = `Mandala ${verse.mandala} • Sukta ${verse.sukta} • Verse ${verse.verse}`;
    document.getElementById('modal-devanagari').textContent = verse.devanagari || '';
    document.getElementById('modal-transliteration').textContent = (verse.transliteration || '').replace(/<BR>/gi, ' ');
    document.getElementById('modal-translation').textContent = verse.translation_griffith || '';

    const tagsContainer = document.getElementById('modal-tags');
    tagsContainer.innerHTML = '';
    const createPill = (text) => {
        const pill = document.createElement('div'); pill.className = 'tag-pill'; pill.textContent = text; tagsContainer.appendChild(pill);
    };
    if (verse.deity) createPill(verse.deity); if (verse.mood) createPill(verse.mood); if (verse.tags) verse.tags.forEach(createPill);

    const sortedIndex = verses.findIndex(v => v.originalIndex === currentVerseIndex);
    document.getElementById('prev-btn').disabled = sortedIndex <= 0;
    document.getElementById('next-btn').disabled = sortedIndex >= verses.length - 1;
    
    document.getElementById('modal-backdrop').style.display = 'flex';
}

function closeVerseModal() {
    document.getElementById('modal-backdrop').style.display = 'none';
}

function navigateTo(direction) {
    const sortedIndex = verses.findIndex(v => v.originalIndex === currentVerseIndex);
    const nextIndex = sortedIndex + direction;
    if (nextIndex >= 0 && nextIndex < verses.length) {
        openVerseModal(verses[nextIndex].originalIndex);
    }
}

function navigateToRandom() {
    closeVerseModal();
    const randomIndex = Math.floor(Math.random() * verses.length);
    zoomToVerse(randomIndex);
}

function setupEventListeners() {
    document.getElementById('random-verse-btn').addEventListener('click', navigateToRandom);
    document.getElementById('zoom-in').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1.5));
    document.getElementById('zoom-out').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
    document.getElementById('reset-view').addEventListener('click', () => svg.transition().duration(750).call(zoom.transform, initialTransform));
    
    document.getElementById('modal-close').addEventListener('click', closeVerseModal);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeVerseModal(); });
    document.getElementById('prev-btn').addEventListener('click', () => navigateTo(-1));
    document.getElementById('next-btn').addEventListener('click', () => navigateTo(1));
    document.getElementById('random-btn').addEventListener('click', navigateToRandom);

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('modal-backdrop').style.display === 'flex') {
            if (e.key === 'Escape') closeVerseModal();
            else if (e.key === 'ArrowLeft') document.getElementById('prev-btn').click();
            else if (e.key === 'ArrowRight') document.getElementById('next-btn').click();
        }
    });

    // ===================================================================
    // THE FIX IS HERE
    // ===================================================================
    window.addEventListener('resize', () => {
        // **THE FIX:** First, completely clear the SVG of all old elements.
        d3.select('#network-svg').html('');
        
        // Now, re-run the entire initialization function.
        // This will redraw everything correctly based on the new window size.
        initializeVisualization();
    });
    // ===================================================================
}
        
init();