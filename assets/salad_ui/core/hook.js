// saladui/core/hook.js
import { registry } from "./factory";

const SaladUIHook = {
  mounted() {
    this.initComponent();
    this.setupServerEvents();

    // Initialize tracking variables for change detection
    this.lastComponentType = this.el.getAttribute("data-component");
    this.lastParts = null;
  },

  initComponent() {
    const el = this.el;
    const componentType = el.getAttribute("data-component");

    if (!componentType) {
      console.error(
        "SaladUI: Component element is missing data-component attribute",
      );
      return;
    }

    // The registry.create method will handle creating the component and calling setupEvents
    this.component = registry.create(componentType, el, this);
  },

  setupServerEvents() {
    if (!this.component) return;

    this.handleEvent("saladui:command", ({ command, params = {}, target }) => {
      if (target && target !== this.el.id) return;

      if (this.component) {
        this.component.handleCommand(command, params);
      }
    });
  },

  updated() {
    if (this.component) {
      // Check if the component wants to preserve state across updates
      const preserveState = this.el.getAttribute("data-preserve-state") === "true";

      // Check if the component's DOM structure has actually changed
      const hasStructuralChanges = this.hasStructuralChanges();

      if (preserveState) {
        // Preserve state: don't recreate component, just update options
        this.updateComponentOptions();

        // For dropdown menus with positioned elements, update position if open
        if (this.component.positionedElement && this.component.positionedElement.update) {
          this.component.positionedElement.update();
        }
      } else if (hasStructuralChanges) {
        // Only recreate if the DOM structure changed and preserve-state is not set
        this.component.destroy();
        this.component = null;
        this.initComponent();
      } else {
        // Just update the options without recreating the component
        this.updateComponentOptions();
      }
    }
  },

  hasStructuralChanges() {
    const el = this.el;

    // Check if the component type changed
    const currentComponentType = el.getAttribute("data-component");
    if (this.lastComponentType !== currentComponentType) {
      this.lastComponentType = currentComponentType;
      return true;
    }

    // Check if the DOM structure changed by comparing data-part elements
    const currentParts = Array.from(el.querySelectorAll("[data-part]"))
      .map(el => ({ part: el.dataset.part, value: el.dataset.value }))
      .sort((a, b) => a.part.localeCompare(b.part));

    if (!this.lastParts) {
      this.lastParts = currentParts;
      return false; // First time, no changes
    }

    const hasChanges = JSON.stringify(currentParts) !== JSON.stringify(this.lastParts);
    this.lastParts = currentParts;
    return hasChanges;
  },

  updateComponentOptions() {
    if (!this.component) return;

    try {
      // Parse new options from the element
      const optionsString = this.el.getAttribute("data-options");
      const newOptions = optionsString ? JSON.parse(optionsString) : {};

      // Update the component's options
      this.component.options = { ...this.component.options, ...newOptions };

      // For select components, update the collection if value changed
      if (this.component.collection && newOptions.value !== undefined) {
        this.component.collection.setValues(newOptions.value);
        if (this.component.updateValueDisplay) {
          this.component.updateValueDisplay();
        }
        if (this.component.syncHiddenInputs) {
          this.component.syncHiddenInputs();
        }
      }

      // Update UI to reflect any changes
      if (this.component.updateUI) {
        this.component.updateUI();
      }
      if (this.component.updatePartsVisibility) {
        this.component.updatePartsVisibility();
      }
    } catch (error) {
      console.error("SaladUI: Error updating component options:", error);
      // Fall back to recreation if update fails
      this.component.destroy();
      this.component = null;
      this.initComponent();
    }
  },

  destroyed() {
    this.component?.destroy();
    this.component = null;
  },
};

export { SaladUIHook };
