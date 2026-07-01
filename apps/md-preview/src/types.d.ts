declare module "markdown-it-task-lists" {
    interface ITaskListOptions {
        enabled?:    boolean;
        label?:      boolean;
        labelAfter?: boolean;
    }

    const plugin: import("markdown-it").PluginWithOptions<ITaskListOptions>;
    export default plugin;
}
