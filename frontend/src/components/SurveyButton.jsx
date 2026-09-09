/**
 * Floating "Take a Survey" button.
 *
 * Only rendered in the production build (hidden while developing/testing
 * locally) and hidden when automated browser runs set the
 * 'praxis_hide_survey' localStorage flag. Place it on the pages where the
 * survey should appear: homepage, login, register, and level select.
 */
export default function SurveyButton() {
  let hidden = false
  try {
    hidden = localStorage.getItem('praxis_hide_survey') === 'true'
  } catch {
    // localStorage unavailable — leave it visible
  }

  if (!import.meta.env.PROD || hidden) return null

  return (
    <a
      href="https://docs.google.com/forms/d/1P4O0MdbQUAUGz-xNL-neMHX5ukDuLTjCq-nXpEaFdb8/viewform"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        backgroundColor: '#16a34a',
        color: '#ffffff',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600',
        textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      Take a Survey
    </a>
  )
}
