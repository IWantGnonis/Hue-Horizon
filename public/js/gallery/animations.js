import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';
import {CustomEase} from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/CustomEase/+esm"; 
gsap.registerPlugin(CustomEase);

// Set initial header opacity to 0
gsap.set(".header", { opacity: 0 });

const customEase = CustomEase.create("custom", ".87,0,.13,1"); 
const counter = document.getElementById("counter");

gsap.set(".video-container", { 
    scale: 0, 
    rotation: -20, 
}); 

gsap.to(".hero", { 
    clipPath: "polygon(0% 45%, 25% 45%, 25% 55%, 0% 55%)", 
    duration: 1.5, 
    ease: customEase, 
    delay: 1, 
});

gsap.to(".hero", {
    clipPath: "polygon(0% 45%, 100% 45%, 100% 55%, 0% 55%)",
    duration: 2, 
    ease: customEase, 
    delay: 3, 
    onStart: () => {
        gsap.to(".progress-bar", {
            width: "100vw",
            duration: 2, 
            ease: customEase, 
        });
        gsap.to("#counter", { // Corrected selector
            innerHTML: 100,
            duration: 2, 
            ease: customEase, 
            snap: { innerHTML: 1 }
        });
    },
});
gsap.to(".hero", {
    clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
    duration: 2, 
    ease: customEase, 
    delay: 5, 
    onStart: () => {

        gsap.to(".video-container", { 
            scale: 1, 
            rotation: 0, 
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            duration: 1.25, 
            ease: customEase, 
            onComplete: () => {
                gsap.to(".header", { 
                    opacity: 1, 
                    duration: 0.5, // Add a small duration for fade-in
                    ease: "power2.out" 
                });
            }
        }); 
    },
});














// Animation utilities