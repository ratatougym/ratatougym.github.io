// Make all external links open in new tabs
document.addEventListener('DOMContentLoaded', function() {
    // Find all links with class "reference external"
    const externalLinks = document.querySelectorAll('a.reference.external');

    externalLinks.forEach(function(link) {
        // Add target="_blank" and rel="noopener noreferrer" for security
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });
});