// ===================================================================
// AUDIO SYSTEM
// ===================================================================
const sounds = {
    click: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-the-sound-pack-tree/tspt_multimedia_button_clickable_025.mp3'),
    zoom: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-the-sound-pack-tree/tspt_multimedia_swoosh_generic_001.mp3'),
    open: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-the-sound-pack-tree/tspt_multimedia_button_generic_002.mp3'),
    close: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-the-sound-pack-tree/tspt_multimedia_button_generic_004.mp3')
};

function playSound(sound) {
    if (sounds[sound]) {
        sounds[sound].currentTime = 0;
        sounds[sound].play().catch(e => console.error("Audio play failed:", e));
    }
}

// ===================================================================
// GLOBAL VARIABLES
// ===================================================================
let verses = [];
let mandalas = [];
let svg, g, zoom;
let currentVerseIndex = -1;
let initialTransform;
let config = {};

// ===================================================================
// INITIALIZATION
// ===================================================================
async function init() {
    try {
        const configResponse = await fetch('./config.json');
        if (!configResponse.ok) throw new Error('config.json not found or could not be loaded.');
        config = await configResponse.json();

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
        errMsg.textContent = `Error: ${error.message}. Please ensure all files (including config.json) are present and you are running this on a server.`;
        errDiv.style.display = 'flex';
        document.getElementById('loading').style.display = 'none';
    }
}

function calculatePositions() {
    const numMandalas = mandalas.length;
    const mainRadius = 300;
    const mandalaRadius = 85;

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

    svg = d3.select('#network-svg').attr('width', width).attr('height', height);
    g = svg.append('g');

    const header = document.getElementById('header');
    const headerHeight = header ? header.offsetHeight : 150;
    const availableHeight = height - headerHeight;
    const vizCenterY = headerHeight + (availableHeight / 2);
    const vizCenterX = width / 2;

    const centralRadius = 110;
    const defs = g.append('defs');
    defs.append('clipPath').attr('id', 'media-clip')
        .append('circle').attr('r', centralRadius);

    g.append('circle')
        .attr('r', centralRadius)
        .attr('fill', 'var(--gold)');
    
    const foreignObject = g.append('foreignObject')
        .attr('width', centralRadius * 2)
        .attr('height', centralRadius * 2)
        .attr('x', -centralRadius)
        .attr('y', -centralRadius)
        .attr('clip-path', 'url(#media-clip)');

    if (config.mediaType === 'video') {
        foreignObject.html(`<video src="${config.mediaURL}" class="central-media-content" autoplay loop muted playsinline></video>`);
    } else {
        foreignObject.html(`<img src="${config.mediaURL}" class="central-media-content">`);
    }

    const mandalaGroups = g.selectAll('.mandala-group')
        .data(mandalas)
        .join('g')
        .attr('class', 'mandala-group')
        .attr('transform', d => `translate(${d.x}, ${d.y})`);

    mandalaGroups.append('circle')
        .attr('class', 'mandala-circle')
        .attr('r', 85)
        .on('click', (event, d) => {
            playSound('zoom');
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
            .attr('r', 1)
            .on('click', (event, d) => {
                playSound('open');
                event.stopPropagation();
                openVerseModal(d.originalIndex);
            });
    });

    const bounds = g.node().getBBox();
    const scale = Math.min(width / bounds.width, availableHeight / bounds.height) * 0.85;
    
    const translateX = vizCenterX - (bounds.x + bounds.width / 2) * scale;
    const translateY = vizCenterY - (bounds.y + bounds.height / 2) * scale;
    
    initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    zoom = d3.zoom()
        .scaleExtent([initialTransform.k, initialTransform.k * 50])
        .on('zoom', (event) => g.attr('transform', event.transform));
    
    svg.call(zoom).call(zoom.transform, initialTransform);
}

// ===================================================================
// NAVIGATION & MODALS
// ===================================================================
function zoomToMandala(mandalaData) {
    const width = svg.attr('width');
    const height = svg.attr('height');
    const headerHeight = document.getElementById('header')?.offsetHeight || 150;
    const availableHeight = height - headerHeight;
    const vizCenterY = headerHeight + availableHeight / 2;
    const vizCenterX = width / 2;
    
    const scale = initialTransform.k * 3.5;
    const transform = d3.zoomIdentity
        .translate(vizCenterX, vizCenterY)
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
    const headerHeight = document.getElementById('header')?.offsetHeight || 150;
    const availableHeight = height - headerHeight;
    const vizCenterY = headerHeight + availableHeight / 2;
    const vizCenterX = width / 2;
    
    const scale = initialTransform.k * 30;
    const targetX = mandala.x + verse.x;
    const targetY = mandala.y + verse.y;
    
    const transform = d3.zoomIdentity
      .translate(vizCenterX, vizCenterY)
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
    playSound('close');
    document.getElementById('modal-backdrop').style.display = 'none';
}

function navigateTo(direction) {
    playSound('click');
    const sortedIndex = verses.findIndex(v => v.originalIndex === currentVerseIndex);
    const nextIndex = sortedIndex + direction;
    if (nextIndex >= 0 && nextIndex < verses.length) {
        openVerseModal(verses[nextIndex].originalIndex);
    }
}

function navigateToRandom() {
    playSound('zoom');
    closeVerseModal();
    const randomIndex = Math.floor(Math.random() * verses.length);
    zoomToVerse(randomIndex);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
    setTimeout(() => { document.body.removeChild(toast); }, 3500);
}

// ===================================================================
// EVENT LISTENERS
// ===================================================================
function setupEventListeners() {
    document.getElementById('random-verse-btn').addEventListener('click', () => {
        playSound('zoom');
        navigateToRandom();
    });

    document.getElementById('zoom-in').addEventListener('click', () => { playSound('click'); svg.transition().duration(300).call(zoom.scaleBy, 1.5); });
    document.getElementById('zoom-out').addEventListener('click', () => { playSound('click'); svg.transition().duration(300).call(zoom.scaleBy, 0.7); });
    document.getElementById('reset-view').addEventListener('click', () => { playSound('zoom'); svg.transition().duration(750).call(zoom.transform, initialTransform); });
    
    document.querySelector('#modal-backdrop .modal-close-btn').addEventListener('click', closeVerseModal);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeVerseModal(); });
    document.getElementById('prev-btn').addEventListener('click', () => navigateTo(-1));
    document.getElementById('next-btn').addEventListener('click', () => navigateTo(1));
    document.getElementById('random-btn').addEventListener('click', navigateToRandom);
    document.getElementById('speaker-btn').addEventListener('click', () => {
        playSound('click');
        showToast('Audio will be added in version 2. Thank you for your patience.');
    });

    const infoModal = document.getElementById('info-modal-backdrop');
    document.getElementById('info-btn').addEventListener('click', () => {
        playSound('open');
        infoModal.style.display = 'flex';
    });
    infoModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        playSound('close');
        infoModal.style.display = 'none';
    });
    infoModal.addEventListener('click', (e) => {
        if (e.target.id === 'info-modal-backdrop') {
            playSound('close');
            infoModal.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('modal-backdrop').style.display === 'flex') {
            if (e.key === 'Escape') closeVerseModal();
            else if (e.key === 'ArrowLeft') document.getElementById('prev-btn').click();
            else if (e.key === 'ArrowRight') document.getElementById('next-btn').click();
        }
        if (document.getElementById('info-modal-backdrop').style.display === 'flex') {
             if (e.key === 'Escape') infoModal.style.display = 'none';
        }
    });

    window.addEventListener('resize', () => {
        d3.select('#network-svg').html('');
        initializeVisualization();
    });
}
        
init();