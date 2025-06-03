export namespace ImgBB {
  export namespace Request {
    /** The form data for deleting an image. */
    interface ImageDelete {
      /** The API key of the ImgBB. */
      auth_token: string;
      action: "delete";
      delete: string;

      from?: string;
      owner?: string;

      deleting: {
        id: string;
        hash: string;
        type?: string;
        url?: string;
        privacy?: string;
        parent_url?: string;
      };
    }
  }

  export namespace Response {
    interface ImageDelete {
      status_code: number;
      status_txt: string;

      success: {
        code: number;
        message: string;
        affected: number;
      };

      request: {
        /** The authentication token of ImgBB API (API Key) which was used. */
        auth_token: string;
        action: "delete";
        delete: string;
        from?: string;
        owner?: string;
        deleting: {
          id: string;
          hash: string;
          type?: string;
          url?: string;
          privacy?: string;
          parent_url?: string;
        };
      };
    }

    interface ImageDeleteFailed {
      status_code: number;
      status_txt: string;
      error: {
        message: string;
        code: number;
      };
    }

    interface ImageUpload {
      /** A boolean indicating the success status of the upload. */
      success: boolean;

      /** An integer representing the status of the upload process. */
      status: number;

      data: {
        id: string;
        title: string;
        width: number;
        height: number;
        size: number;
        time: number;
        expiration: number;

        /** The direct URL of the uploaded image (without any resizing). */
        url: string;
        url_viewer: string;
        delete_url: string;
        display_url: string;

        image: {
          filename: string;
          name: string;
          mime: string;
          extension: string;
          url: string;
        };

        thumb: {
          filename: string;
          name: string;
          mime: string;
          extension: string;
          url: string;
        };

        medium: {
          filename: string;
          name: string;
          mime: string;
          extension: string;
          url: string;
        };
      };
    }
  }
}
