const main = document.querySelector(".main");
const classical = document.querySelector("classical")
const hero = document.querySelector(".hero");


        gsap.fromTo("#hero-subtext", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1, delay: 0.5 });

        const sections = ["#artworks", "#mood", "#auction", "#marketplace"];
        sections.forEach((id, index) => {
            gsap.fromTo(`${id} img`, { opacity: 0, x: -50 }, { 
                opacity: 1, x: 0, duration: 1, 
                scrollTrigger: { trigger: id, start: "top 80%" } 
            });

            gsap.fromTo(`${id} div h3`, { opacity: 0, x: 50 }, { 
                opacity: 1, x: 0, duration: 1, 
                scrollTrigger: { trigger: id, start: "top 80%" } 
            });

            gsap.fromTo(`${id} div p`, { opacity: 0, y: 20 }, { 
                opacity: 1, y: 0, duration: 1, 
                scrollTrigger: { trigger: id, start: "top 80%" } 
            });
        });

        
        gsap.from(".hro-txt",{
            y: '100%', // Change y start position to slide up from within the overflow container
            stagger:0.5,
            ease:"power2.out",
            delay:1,
            duration:2
        })
        
        gsap.from(".minhro",{
            opacity:0,
            stagger:0.1,
            ease:"power2.out",
            delay:4,
            duration:1
        })
        
        

        
        
        gsap.from(".page2",{
            y:500
        })
