



const cursor = document.querySelector('.cursor');
let isHovered = false;
let cursorSize = 12;

const manageMouseMove = (e) => {
  const { clientX, clientY } = e;
  const stickyElement = document.querySelector('.bounds');
  const { left, top, height, width } = stickyElement.getBoundingClientRect();

  // Center position of the stickyElement
  const center = { x: left + width / 2, y: top + height / 2 };

  if (isHovered) {
    // Distance between the mouse pointer and the center of the custom cursor
    const distance = { x: clientX - center.x, y: clientY - center.y };
    
    // Calculate angle for rotation
    const angle = Math.atan2(distance.y, distance.x) * (180 / Math.PI);
    
    // Calculate distance for scaling
    const dist = Math.sqrt(distance.x * distance.x + distance.y * distance.y);
    const maxDist = Math.sqrt((width/2) * (width/2) + (height/2) * (height/2));
    const scale = 1 + (dist / maxDist) * 0.5; // Max 1.5x scale

    // Move mouse to center of stickyElement with smooth movement
    gsap.to(cursor, {
      x: (center.x - cursorSize / 2) + (distance.x * 0.15),
      y: (center.y - cursorSize / 2) + (distance.y * 0.15),
      duration: 0.15,
      ease: "power3.out",
      rotation: angle,
      scaleX: scale,
      scaleY: 1,
      width: cursorSize,
      height: cursorSize
    });

  } else {
    // Move custom cursor to the mouse position with smooth movement
    gsap.to(cursor, {
      x: clientX - cursorSize / 2,
      y: clientY - cursorSize / 2,
      duration: 0.15,
      ease: "power3.out",
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      width: cursorSize,
      height: cursorSize
    });
  }
};

const manageMouseOver = () => {
  isHovered = true;
  cursorSize = 80;
  gsap.to(cursor, {
    duration: 0.2,
    ease: "power2.out",
    scaleX: 1,
    scaleY: 1
  });
};

const manageMouseLeave = () => {
  isHovered = false;
  cursorSize = 12;
  gsap.to(cursor, {
    duration: 0.2,
    ease: "power2.out",
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  });
};

const stickyElement = document.querySelector('.bounds');

stickyElement.addEventListener("mouseenter", manageMouseOver);
stickyElement.addEventListener("mouseleave", manageMouseLeave);
window.addEventListener("mousemove", manageMouseMove);



// This is a simplified version of the Magnetic component, adapted for plain JS.
// It doesn't handle React-specific features like props or children.





