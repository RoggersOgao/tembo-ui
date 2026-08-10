export const createUserMarkerElement = (
  avatar?: string,
  navigating: boolean = false,
  heading?: number
) => {
  const el = document.createElement('div');
  el.className = 'relative';
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';

  if (avatar) {
    // Avatar-based marker with Uber-style ring
    el.className += ' w-10 h-10';
    el.innerHTML = `
      <div class="absolute inset-0">
        <!-- Outer pulsing ring -->
        <div class="absolute inset-0 bg-blue-400/30 rounded-full animate-ping" style="transform: scale(1.8); animation-duration: 2s;"></div>
        <!-- Middle expanding ring -->
        <div class="absolute inset-0 bg-blue-400/20 rounded-full animate-pulse" style="transform: scale(1.4);"></div>
        <!-- Inner static ring -->
        <div class="absolute inset-0 bg-white/30 rounded-full" style="transform: scale(1.1);"></div>
      </div>
      <!-- Avatar container with Uber-style black border -->
      <div class="relative shadow-xl border-2 border-black rounded-full w-full h-full overflow-hidden transform transition-transform hover:scale-105">
        <img src="${avatar}" alt="You" class="w-full h-full object-cover" />
      </div>
      ${
        navigating
          ? `<div class="absolute -top-1 -right-1 bg-green-500 border-2 border-white rounded-full w-5 h-5 shadow-lg"></div>
             <div class="absolute -top-1 -right-1 bg-green-500 rounded-full w-5 h-5 animate-ping opacity-75"></div>`
          : ''
      }
    `;
  } else {
    // Non-avatar Uber-style marker (the classic Uber dot with heading arrow)
    el.className += ' w-16 h-16';
    el.innerHTML = `
      <!-- Outer rings -->
      <div class="absolute inset-0">
        <!-- Far pulsing ring -->
        <div class="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" style="transform: scale(2.5); animation-duration: 2.5s;"></div>
        <!-- Mid expanding ring -->
        <div class="absolute inset-0 bg-blue-500/30 rounded-full animate-pulse" style="transform: scale(1.8);"></div>
        <!-- Close ring -->
        <div class="absolute inset-0 bg-blue-500/40 rounded-full" style="transform: scale(1.2);"></div>
      </div>
      
      <!-- Main marker -->
      <div class="absolute inset-0 flex justify-center items-center">
        <div class="relative">
          <!-- Direction arrow (only shows when navigating/have heading) -->
          ${
            navigating && heading !== undefined
              ? `
            <div class="absolute -top-8 left-1/2 transform -translate-x-1/2" 
                 style="transform: rotate(${heading}deg) translateX(-50%);">
              <div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[16px] border-b-blue-600"></div>
            </div>
          `
              : ''
          }
          
          <!-- Uber-style dot -->
          <div class="relative">
            <!-- Inner dot with shadow -->
            <div class="w-8 h-8 bg-blue-600 rounded-full shadow-2xl border-2 border-white transform transition-transform hover:scale-110"></div>
            
            <!-- Navigation indicator -->
            ${
              navigating
                ? `
              <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                <div class="w-1 h-1 bg-green-400 rounded-full"></div>
              </div>
            `
                : ''
            }
          </div>
          
          <!-- Small dot in center (Uber's signature style) -->
          <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div class="w-2 h-2 bg-white rounded-full shadow-lg"></div>
          </div>
        </div>
      </div>
    `;
  }

  return el;
};