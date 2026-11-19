import React from 'react'

// Library owns which publishing step PublisherTab shows. Runtime tests mount
// PublisherTab alone, so this stands in for Library: one stable host per
// component, so re-rendering with new props keeps the step.
const hosts = new WeakMap()

export function inLibrary(PublisherTab) {
  if (!hosts.has(PublisherTab)) {
    hosts.set(PublisherTab, function LibraryYourApps(props) {
      const [view, setView] = React.useState('home')
      return React.createElement(PublisherTab, { ...props, view, onViewChange: setView })
    })
  }
  return hosts.get(PublisherTab)
}
