import { FileUpload } from '@openai/apps-sdk-ui/components/Icon'
import { FromUrlTab } from './FromUrlTab.jsx'

export function CommunityTab({ onPreview, token }) {
  return (
    <div className="st-community">
      <FromUrlTab onPreview={onPreview} token={token} />

      <section className="st-publish-card" aria-label="Publish your apps">
        <span className="st-publish-icon" aria-hidden="true">
          <FileUpload />
        </span>
        <div className="st-publish-body">
          <div className="st-publish-heading">
            <h3 className="st-publish-title">Publish your apps here</h3>
            <span className="st-publish-badge">Coming soon</span>
          </div>
          <p className="st-publish-text">
            Share the apps you build with the wider Möbius community. Submitting
            your own apps to the catalog isn’t open yet — check back soon.
          </p>
        </div>
      </section>
    </div>
  )
}
