<script>
/*
    ✅ Things to check if it still doesn’t work:
    
    HTML elements:
    Make sure you actually have elements with the class secret-iframe, for example:
    
    <iframe class="secret-iframe" width="600" height="400"></iframe>
    
    
    CORS (Cross-Origin Resource Sharing):
    Some URLs (like archive.today) may block embedding in <iframe>s — browsers will show “refused to connect” or similar errors in the console.
    That’s not a script issue — it’s a browser security policy.
    
    External JSON availability:
    Visit https://backlinkexchange.github.io/backlink-templates/secret-templates.json manually to see if it’s accessible and properly formatted (should be an array like ["https://...", "https://..."]).
    
    Console errors:
    Press F12 → Console tab in your browser. Any red text there will help pinpoint the issue.
*/
  
  let secretTemplates = [
    "https://cachedview.nl/#[URL]",
    "https://web.archive.org/save/[URL]",
    "https://web.archive.org/web/[URL]",
    "https://web.archive.org/web/*/[URL]",
    "https://archive.today/submit/?anyway=1&url=[ENCODE_URL]",
    "https://archive.today/[ENCODE_URL]"
  ];

  const currentUrl = window.location.href;
  const encodedUrl = encodeURIComponent(currentUrl);
  const iframes = document.querySelectorAll('.secret-iframe');

  function setRandomUrlInIframes() {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    iframes.forEach(iframe => {
      const randomTemplate = secretTemplates[Math.floor(Math.random() * secretTemplates.length)];
      let finalUrl;

      if (randomTemplate.includes("[ENCODE_URL]")) {
        finalUrl = randomTemplate.replace("[ENCODE_URL]", encodedUrl);
      } else {
        finalUrl = randomTemplate.replace("[URL]", currentUrl);
      }

      iframe.src = finalUrl;
    });

    setTimeout(() => {
      window.scrollTo(scrollX, scrollY);
    }, 50);
  }

  // Try loading external JSON
  fetch("https://backlinkexchange.github.io/backlink-templates/secret-templates.json")
    .then(response => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then(data => {
      if (Array.isArray(data) && data.length) {
        secretTemplates = data;
        console.log("✅ Loaded templates from JSON");
      } else {
        throw new Error("Invalid JSON format");
      }
    })
    .catch(error => {
      console.warn("⚠️ Failed to load external templates, using default. Reason:", error.message);
    })
    .finally(() => {
      // Start iframe loading loop after fetch attempt
      setRandomUrlInIframes();
      setInterval(setRandomUrlInIframes, 15000);
    });
</script>
